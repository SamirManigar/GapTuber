import { NextRequest, NextResponse } from "next/server";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { z } from "zod";
import { getRandomYouTubeApiKey } from "@/lib/youtube-server";
import { auth } from "@/auth";
import { getChannelById, updateChannelBlueprint, getUserByEmail, deductUserCredits } from "@/db/queries";
import { logger } from "@/lib/logger";
import { getValidYouTubeToken } from "@/lib/youtube-tokens";
import {
    computeVelocityScore,
    computeFreshnessGapScore,
    computeTrendMomentum,
    computeSaturationScore,
    type VideoData,
} from "@/lib/engine/scoring";
import { getSearchResults } from "@/lib/youtube-server";
import { db } from "@/db";
import { competitorMonitors, competitorInsights, ideaVault } from "@/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import {
    buildOutcomeLearningProfile,
    formatOutcomeLearningContext,
    getOutcomeAdjustment,
} from "@/lib/engine/outcome-learning";
import { hasNonCurrentYear } from "@/lib/idea-freshness";

export const maxDuration = 300; // Fluid Compute: 5 minute max on Vercel Hobby plan

// ─── Zod Schema (Issues #18, #12) — replaces fragile JSON.parse ──────────────

const VideoIdeaSchema = z.object({
    title: z.string().describe("Catchy, clickable YouTube video title"),
    hook: z.string().describe("First 10 seconds script hook"),
    format: z.string().describe("Start with segment prefix then format type e.g. 'DISCOVERY | Tutorial' or 'RETENTION | Deep Dive' or 'WILDCARD | Reaction'"),
    whyItWorks: z.string().describe("Why this fits the creator's current audience"),
    estimatedViewPotential: z.enum(["high", "medium", "low"]),
    targetAudience: z.string().describe("Who this video is made for"),
    signalSource: z.string().optional().describe("Primary signal: 'Watchtower', 'Comment Demand', 'Velocity Signal', 'Trend Momentum', or 'Market Gap'"),
});

const ResponseSchema = z.object({
    videoIdeas: z.array(VideoIdeaSchema).length(5),
});

// ─── Request Schema ───────────────────────────────────────────────────────────

const RequestBodySchema = z.object({
    channelId: z.string().uuid(),
    channelStats: z.record(z.string(), z.any()).optional(),
    recentVideos: z.array(z.record(z.string(), z.any())).optional(),
    useWatchtower: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let rawBody: unknown;
        try {
            rawBody = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
        }

        const parsed = RequestBodySchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { channelId, channelStats, recentVideos, useWatchtower } = parsed.data;

        const channel = await getChannelById(channelId);
        // Issue #1 fix: verify ownership via DB UUID, not Google OAuth sub
        const dbUser = await getUserByEmail(session.user.email);
        if (!channel || !dbUser || channel.userId !== dbUser.id) {
            return NextResponse.json({ error: "Channel not found or unauthorized" }, { status: 404 });
        }

        if (dbUser.credits < 1) {
            return NextResponse.json({ error: "Insufficient credits. You need 1 credit to generate ideas." }, { status: 402 });
        }

        const allVaultIdeas = await db.query.ideaVault.findMany({
            where: (iv, { eq }) => eq(iv.channelId, channelId),
        });
        const outcomeLearning = buildOutcomeLearningProfile(allVaultIdeas);
        const outcomeLearningBlock = formatOutcomeLearningContext(outcomeLearning);

        let actualChannelStats = channelStats;
        let actualRecentVideos = recentVideos || [];

        // If the user is connected to YouTube, fetch their actual stats and videos!
        if (channel.youtubeAccessToken) {
            try {
                const { accessToken } = await getValidYouTubeToken(channelId);
                const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
                
                // Fetch channel info
                const channelRes = await fetch(
                    `${YOUTUBE_API_BASE}/channels?part=snippet,statistics,contentDetails&mine=true`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                
                if (!channelRes.ok) {
                    const err = await channelRes.json();
                    if (err.error?.code === 403) throw new Error("QUOTA_EXCEEDED");
                    throw new Error(err.error?.message || "YouTube API error");
                }
                const channelData = await channelRes.json();
                const ytChannel = channelData.items?.[0];

                if (ytChannel) {
                    actualChannelStats = {
                        title: ytChannel.snippet?.title,
                        subscribers: ytChannel.statistics?.subscriberCount,
                        views: ytChannel.statistics?.viewCount,
                        videoCount: ytChannel.statistics?.videoCount,
                    };

                    // Fetch latest 10 videos using uploads playlist (1 quota unit instead of 100 for search!)
                    const uploadsPlaylistId = ytChannel.contentDetails?.relatedPlaylists?.uploads;
                    if (uploadsPlaylistId) {
                        const videosRes = await fetch(
                            `${YOUTUBE_API_BASE}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=10`,
                            { headers: { Authorization: `Bearer ${accessToken}` } }
                        );
                        
                        if (videosRes.ok) {
                            const videosData = await videosRes.json();
                            const videoIds = videosData.items?.map((v: any) => v.contentDetails?.videoId).filter(Boolean).join(",");
                        if (videoIds) {
                            const statsRes = await fetch(
                                `${YOUTUBE_API_BASE}/videos?part=statistics,snippet&id=${videoIds}`,
                                { headers: { Authorization: `Bearer ${accessToken}` } }
                            );
                            if (statsRes.ok) {
                                const statsData = await statsRes.json();
                                actualRecentVideos = (statsData.items || []).map((v: any) => ({
                                    title: v.snippet?.title,
                                    views: v.statistics?.viewCount,
                                    likes: v.statistics?.likeCount,
                                    publishedAt: v.snippet?.publishedAt,
                                }));
                            }
                            }
                        }
                    }
                }
            } catch (error) {
                if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
                    logger.warn("[GenerateIdeas] YouTube Quota Exceeded. Using niche market context.");
                } else {
                    logger.error("[GenerateIdeas] Failed to fetch real YouTube data", error);
                }
                // Fallback: use channel's stored topic for market context — never inject fake views/likes
                // The AI prompt will signal DATA UNAVAILABLE so scoring is market-based, not channel-based
                actualRecentVideos = [];
                actualChannelStats = {
                    title: channel.topic || channel.category || "Connected Channel",
                    subscribers: channel.category ? `Linked (${channel.category} niche)` : "Linked",
                    views: "[DATA UNAVAILABLE — use market signals only]",
                    videoCount: "[DATA UNAVAILABLE]",
                };
            }
        }

        actualChannelStats ??= {
            title: channel.name,
            subscribers: "unavailable",
            views: "unavailable",
            videoCount: "unavailable",
        };

        const keys = [
            process.env.GROQ_API_KEY,
            process.env.GROQ_API_KEY_2,
            process.env.GROQ_API_KEY_3,
        ].filter(Boolean) as string[];

        if (keys.length === 0) {
            return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
        }

        // ── Format channel data for the prompt ───────────────────────────────
        const topVideos = (actualRecentVideos as any[])
            .sort((a, b) => (parseInt(b.views) || 0) - (parseInt(a.views) || 0))
            .slice(0, 10)
            .map((v, i) => `  ${i + 1}. "${v.title}" — ${parseInt(v.views || "0").toLocaleString()} views, ${parseInt(v.likes || "0").toLocaleString()} likes — published ${v.publishedAt?.slice?.(0, 10) || "date unavailable"}`)
            .join("\n");

        // Map to VideoData objects to compute deterministic statistical signals
        const scoringVideos: VideoData[] = (actualRecentVideos as any[]).map((v, i) => ({
            title: v.title || `Video ${i + 1}`,
            views: parseInt(v.views) || 0,
            likes: parseInt(v.likes) || 0,
            comments: parseInt(v.comments) || 0,
            uploadDate: v.publishedAt || new Date().toISOString(),
            url: `https://youtube.com/watch?v=demo${i}`,
            channel: actualChannelStats?.title || "Creator",
        }));

        const velocitySignal = computeVelocityScore(scoringVideos);
        const abandonmentSignal = computeFreshnessGapScore(scoringVideos);
        const trendSignal = computeTrendMomentum(scoringVideos);

        // Tier 4: Broader market/competitor intelligence (YouTube search)
        let marketContextBlock = "";
        let marketSearchResults: Awaited<ReturnType<typeof getSearchResults>> = [];
        let ytApiKey: string | null = null;
        try {
            ytApiKey = getRandomYouTubeApiKey();
        } catch {
            logger.warn("[GenerateIdeas] YouTube API key unavailable for live market lookup.");
        }
        const targetTopic = channel.topic || channel.category;
        if (ytApiKey && targetTopic) {
            try {
                const marketWindowStart = new Date();
                marketWindowStart.setUTCDate(marketWindowStart.getUTCDate() - 180);
                marketSearchResults = await getSearchResults(targetTopic, ytApiKey, 20, marketWindowStart);
                if (marketSearchResults.length > 0) {
                    const satScore = computeSaturationScore(marketSearchResults);
                    const topCompTitles = marketSearchResults.slice(0, 10).map(r =>
                        `  - "${r.title}" by ${r.channel} — ${r.views.toLocaleString()} views — published ${r.uploadDate.slice(0, 10)}`
                    ).join("\n");
                    marketContextBlock = `\nRECENT YOUTUBE MARKET EVIDENCE ("${targetTopic}", published in the last 180 days):\n- Search sample: ${marketSearchResults.length} videos fetched live from YouTube Data API\n- Market Saturation Score: ${satScore.score.toFixed(1)}/10 (${satScore.competitionLevel} competition)\n- Recent relevant videos:\n${topCompTitles}\n`;
                }
            } catch (error) {
                logger.warn("[GenerateIdeas] Live market lookup failed", error);
            }
        }

        if (actualRecentVideos.length === 0 && marketSearchResults.length === 0) {
            return NextResponse.json(
                { error: "Live YouTube evidence is temporarily unavailable. No ideas were generated from model memory." },
                { status: 503 },
            );
        }

        // Tier 5: Inject Top Audience Pain Points (Comment Miner)
        let audienceMiningBlock = "";
        let audienceEvidenceCount = 0;
        const minedFrustrations = allVaultIdeas
            .filter(iv => iv.source === "comment_mining")
            .slice(-5);
        if (minedFrustrations.length > 0) {
            audienceEvidenceCount = minedFrustrations.length;
            const frustrationLines = minedFrustrations.map(f => `  - Theme: "${f.title}" (Angle: ${f.whyItWorks || f.hook})`).join("\n");
            audienceMiningBlock = `\nVERIFIED AUDIENCE PAIN POINTS (Mined from Competitor Comments):\n${frustrationLines}\n`;
        }

        // ── UPGRADE 1: Pipe Watchtower Signals (only if user enabled it) ──────────
        let watchtowerBlock = "";
        let watchtowerEvidenceCount = 0;
        if (useWatchtower) {
            try {
                const monitors = await db.select()
                    .from(competitorMonitors)
                    .where(eq(competitorMonitors.channelId, channelId))
                    .limit(5);

                if (monitors.length > 0) {
                    const allInsights = (
                        await Promise.all(
                            monitors.map(m =>
                                db.select().from(competitorInsights)
                                    .where(eq(competitorInsights.monitorId, m.id))
                                    .orderBy(desc(competitorInsights.createdAt))
                                    .limit(3)
                            )
                        )
                    ).flat();

                    const highSignals = allInsights
                        .filter(i => (i.analysis as any)?.viralityScore >= 70)
                        .sort((a, b) => ((b.analysis as any)?.viralityScore ?? 0) - ((a.analysis as any)?.viralityScore ?? 0))
                        .slice(0, 4);

                    if (highSignals.length > 0) {
                        watchtowerEvidenceCount = highSignals.length;
                        const signalLines = highSignals.map(i => {
                            const a = i.analysis as any;
                            return [
                                `  • Rival Video: "${i.title}" (${parseInt(i.views).toLocaleString()} views, ${a.viralityScore}% heat)`,
                                `    - Gap to Exploit: ${a.theGap}`,
                                `    - Counter Title: ${a.counterTitle || "N/A"}`,
                                `    - Target Keywords: ${a.targetKeywords || "N/A"}`,
                            ].join("\n");
                        }).join("\n");
                        watchtowerBlock = `\nWATCHTOWER COMPETITOR INTELLIGENCE (Your Tracked Rivals):\n${signalLines}\n`;
                    }
                }
            } catch { /* non-fatal — roadmap continues without watchtower data */ }
        }

        // ── UPGRADE 2: Upload Timing Intelligence ────────────────────────────
        let timingBlock = "";
        let timingData: { bestDay: string; bestHourFmt: string; ranking: string[]; sampleSize: number } | null = null;
        try {
            const videosWithDates = (actualRecentVideos as any[]).filter(v => v.publishedAt);
            if (videosWithDates.length >= 8) {
                const dayCount: Record<string, number[]> = {};
                const hourCount: Record<number, number[]> = {};

                videosWithDates.forEach(v => {
                    const d = new Date(v.publishedAt);
                    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
                    const hour = Math.floor(d.getUTCHours() / 4) * 4;
                    const views = parseInt(v.views || "0");
                    dayCount[day] = [...(dayCount[day] || []), views];
                    hourCount[hour] = [...(hourCount[hour] || []), views];
                });

                const avgByDay = Object.entries(dayCount).filter(([, views]) => views.length >= 2).map(([day, views]) => ({
                    day, avg: views.reduce((a, b) => a + b, 0) / views.length
                })).sort((a, b) => b.avg - a.avg);

                const avgByHour = Object.entries(hourCount).filter(([, views]) => views.length >= 2).map(([hour, views]) => ({
                    hour: parseInt(hour), avg: views.reduce((a, b) => a + b, 0) / views.length
                })).sort((a, b) => b.avg - a.avg);

                const bestDay = avgByDay[0]?.day;
                const bestHour = avgByHour[0]?.hour;
                if (bestDay && bestHour !== undefined) {
                    const endHour = (bestHour + 4) % 24;
                    const bestHourFmt = `${String(bestHour).padStart(2, "0")}:00–${String(endHour).padStart(2, "0")}:00 UTC`;
                    const ranking = avgByDay.slice(0, 3).map(d => `${d.day} (${Math.round(d.avg).toLocaleString()} avg views)`);

                    timingData = { bestDay, bestHourFmt, ranking, sampleSize: videosWithDates.length };
                    timingBlock = `\nHISTORICAL PUBLISH-TIME PATTERN (descriptive, not causal):\n- Best observed day: ${bestDay}\n- Best observed 4-hour window: ${bestHourFmt}\n- Sample: ${videosWithDates.length} channel uploads; only repeated day/time buckets were eligible\n`;
                }
            }
        } catch { /* non-fatal */ }

        // ── Deduplication Guard ───────────────────────────────────────────────
        let deduplicationBlock = "";
        const existingTitles = allVaultIdeas.filter(iv => iv.source === "system");
        if (existingTitles.length > 0) {
            const titleList = existingTitles.slice(-10).map((v: any) => `  - "${v.title}"`).join("\n");
            deduplicationBlock = `\nALREADY GENERATED — DO NOT REPEAT OR CLOSELY IMITATE:\n${titleList}\n`;
        }

        // ── Confidence Score — normalized weighted average (0-100) ─────────────
        // Weights sum to 100%: velocity(30) + trend(25) + abandonment(20) + market(15) + watchtower(10)
        const velocityPct  = Math.min(10, velocitySignal.score)  / 10; // normalize 0-10 → 0-1
        const trendPct     = Math.min(10, trendSignal.score)     / 10;
        const abandonPct   = Math.min(10, abandonmentSignal.score) / 10;
        const marketPct    = marketContextBlock ? 1 : 0.4; // has market data = full, no market = partial
        const watchtowerPct = watchtowerBlock ? 1 : 0;

        const confidenceScore = Math.min(100, Math.round(
            velocityPct  * 30 +
            trendPct     * 25 +
            abandonPct   * 20 +
            marketPct    * 15 +
            watchtowerPct * 10
        ));

        const generatedAt = new Date();
        const currentYear = generatedAt.getUTCFullYear();
        const marketWindowStartIso = new Date(generatedAt.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
        const allowedSignalSources = [
            actualRecentVideos.length > 0 ? "Velocity Signal" : null,
            actualRecentVideos.length >= 3 ? "Trend Momentum" : null,
            marketSearchResults.length > 0 ? "Market Gap" : null,
            audienceMiningBlock ? "Comment Demand" : null,
            watchtowerBlock ? "Watchtower" : null,
        ].filter((value): value is string => Boolean(value));
        const formatVerifiedCount = (value: unknown) => {
            const parsed = Number.parseInt(String(value ?? ""), 10);
            return Number.isFinite(parsed) ? parsed.toLocaleString() : "unavailable";
        };

        const prompt = `You are an evidence-constrained YouTube content strategist. You synthesize supplied data; you do not use model memory as evidence.

CURRENT UTC DATE: ${generatedAt.toISOString()}
CURRENT YEAR: ${currentYear}

TASK: Analyze this creator's performance history alongside competitor intelligence, upload timing, market data, and audience pain points. Generate exactly 5 ultra-high-quality, viral video blueprints designed for explosive CTR and maximum retention.

VIRAL STRATEGY RULES:
1. HIGH-IMPACT TITLES: Use psychological triggers (Curiosity Gaps, FOMO, Contrarian Angles, Challenging Status Quo). Titles must be irresistibly clickable.
2. CURRENT & TRENDING: Use only the dated evidence supplied below. Do not infer that a product, model version, price, free tier, feature, watermark policy, or trend is current unless that exact fact appears in the evidence.
3. OUTLIER HOOK FORMULA: The first 10 seconds hook MUST feature a pattern interrupt. Deliver the title promise instantly.
4. SURGICAL VALUE: Address verified audience pain points from the Comment Miner data.

CREATOR CHANNEL DATA:
- Channel Name: ${String(actualChannelStats?.title || "Unknown")}
- Subscribers: ${formatVerifiedCount(actualChannelStats?.subscribers)}
- Total Views: ${formatVerifiedCount(actualChannelStats?.views)}
- Total Videos: ${formatVerifiedCount(actualChannelStats?.videoCount)}

COMPUTED INTERNAL GAP SIGNALS:
- Velocity Score: ${velocitySignal.score.toFixed(1)}/10 (${velocitySignal.insight})
- Topic Abandonment Score: ${abandonmentSignal.score.toFixed(1)}/10 (${abandonmentSignal.insight})
- Trend Momentum Score: ${trendSignal.score.toFixed(1)}/10 (${trendSignal.insight})

THEIR TOP RECENT VIDEOS (Ground Truth API Data):
${topVideos}
${marketContextBlock}${audienceMiningBlock}${watchtowerBlock}${timingBlock}${outcomeLearningBlock}
── MANDATORY OUTPUT SEGMENTATION ──
Distribute the 5 ideas exactly as follows. Start the "format" field with the segment prefix:
1. DISCOVERY | <format> — SEO video targeting a specific keyword cluster to attract brand-new viewers.
2. DISCOVERY | <format> — Second search concept hitting a different keyword cluster or sub-topic.
3. RETENTION | <format> — Deep-dive or series for existing subscribers. Maximize watch time.
4. RETENTION | <format> — Community-building content. Reward loyal viewers with exclusive value.
5. WILDCARD | <format> — Bold, controversial, or trend-hijacking bet. Maximum viral upside.

ALLOWED EVIDENCE LABELS: ${allowedSignalSources.join(", ")}.
For each idea, set "signalSource" to exactly one allowed label that is genuinely supported by the supplied block. Never invent Watchtower, comment, market, velocity, or trend evidence. Do not put any year other than ${currentYear} in a title or hook. Prefer no year at all.
${deduplicationBlock}
Output exactly 5 blueprints matching this segmentation.`;

        // ── Key-rotation retry loop with generateObject (Issue #12 / #18 fix) ─
        let videoIdeas: z.infer<typeof VideoIdeaSchema>[] | null = null;
        let lastError: unknown = null;
        const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

        for (const activeKey of shuffledKeys) {
            try {
                const groq = createGroq({ apiKey: activeKey });
                const result = await generateText({
                    model: groq("openai/gpt-oss-120b"),
                    messages: [
                        { role: "system", content: "You must output ONLY valid JSON that strictly matches the required schema. No markdown fences, no explanatory text." },
                        { role: "user", content: prompt + `\n\nREQUIRED JSON SCHEMA:\n${JSON.stringify({ videoIdeas: [{ title: "string", hook: "string", format: "DISCOVERY | Tutorial", whyItWorks: "string", estimatedViewPotential: "high|medium|low", targetAudience: "string", signalSource: "string" }] }, null, 2)}` }
                    ],
                    temperature: 0.7,
                });
                let rawText = result.text.trim();
                // Basic cleanup if the model still wrapped in markdown despite instructions
                if (rawText.startsWith("```json")) rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                else if (rawText.startsWith("```")) rawText = rawText.replace(/```/g, "").trim();
                
                const parsedJson: unknown = JSON.parse(rawText);
                const normalized = Array.isArray(parsedJson) ? { videoIdeas: parsedJson } : parsedJson;
                const validated = ResponseSchema.safeParse(normalized);
                if (!validated.success) throw new Error(`Invalid AI response: ${validated.error.message}`);
                if (validated.data.videoIdeas.some(idea => hasNonCurrentYear(idea, currentYear))) {
                    throw new Error(`AI response used a non-current year; expected ${currentYear}.`);
                }
                if (validated.data.videoIdeas.some(idea => !idea.signalSource || !allowedSignalSources.includes(idea.signalSource))) {
                    throw new Error("AI response cited an evidence source that was not available.");
                }
                videoIdeas = validated.data.videoIdeas;
                break;
            } catch (err) {
                lastError = err;
                logger.warn("[GenerateIdeas] Key failed, rotating...");
            }
        }

        if (!videoIdeas) {
            logger.error("[GENERATE_IDEAS_ERROR] All keys exhausted.", lastError);
            return NextResponse.json({ error: "AI generation failed" }, { status: 503 });
        }

        // Within each mandatory segment, rank ideas using creator-specific measured
        // outcomes. This is deterministic; the model cannot invent the adjustment.
        const rankSegment = (ideas: z.infer<typeof VideoIdeaSchema>[]) => [...ideas].sort((a, b) =>
            getOutcomeAdjustment(outcomeLearning, b.signalSource).adjustment
            - getOutcomeAdjustment(outcomeLearning, a.signalSource).adjustment
        );
        videoIdeas = [
            ...rankSegment(videoIdeas.slice(0, 2)),
            ...rankSegment(videoIdeas.slice(2, 4)),
            ...videoIdeas.slice(4),
        ];

        // Save to database. Preserve anything the creator has acted on or linked;
        // those records are the training history for future recommendations.
        await db.delete(ideaVault).where(
            and(
                eq(ideaVault.channelId, channelId),
                eq(ideaVault.source, "system"),
                eq(ideaVault.status, "backlog"),
                isNull(ideaVault.youtubeVideoId),
            )
        );

        // 2. Insert new ideas
        if (videoIdeas && videoIdeas.length > 0) {
            const inserts = videoIdeas.map(idea => {
                const learned = getOutcomeAdjustment(outcomeLearning, idea.signalSource);
                const baseOpportunity = idea.estimatedViewPotential === "high" ? 80 : idea.estimatedViewPotential === "medium" ? 60 : 40;
                return {
                channelId: channelId,
                title: idea.title || "Untitled Idea",
                hook: idea.hook,
                format: idea.format,
                targetAudience: idea.targetAudience,
                status: "backlog" as const,
                estimatedViewPotential: (idea.estimatedViewPotential || "medium") as "high" | "medium" | "low",
                source: "system" as const,
                referenceId: idea.signalSource || "",  // Store AI signal (Velocity Signal, Market Gap, etc.)
                whyItWorks: idea.whyItWorks,
                script: "",
                description: "",
                tags: [],
                opportunityScoreAtRecommendation: Math.min(100, Math.round(baseOpportunity * learned.adjustment)),
                confidenceAtRecommendation: confidenceScore / 100,
                recommendationSignals: {
                    liveSignals: {
                        velocity: velocitySignal.score,
                        abandonment: abandonmentSignal.score,
                        trend: trendSignal.score,
                    },
                    outcomeLearning: {
                        version: outcomeLearning.version,
                        active: outcomeLearning.active,
                        source: idea.signalSource || "unknown",
                        sampleSize: learned.sampleSize,
                        adjustment: learned.adjustment,
                        confidence: learned.confidence,
                    },
                    provenance: {
                        source: "YouTube Data API v3",
                        generatedAt: generatedAt.toISOString(),
                        marketWindowStart: marketWindowStartIso,
                        marketSampleSize: marketSearchResults.length,
                        channelSampleSize: actualRecentVideos.length,
                        allowedSignalSources,
                        audienceEvidenceCount,
                        watchtowerEvidenceCount,
                    },
                    timingData,
                },
                recommendedAt: generatedAt,
                scoringVersion: `v2.0+${outcomeLearning.version}`,
            }});
            await db.insert(ideaVault).values(inserts);
        }

        // Deduct credit
        await deductUserCredits(dbUser.id, 1, "Idea Generation");

        return NextResponse.json({
            success: true,
            videoIdeas,
            confidenceScore,
            timingData,
            provenance: {
                source: "YouTube Data API v3",
                generatedAt: generatedAt.toISOString(),
                marketWindowStart: marketWindowStartIso,
                marketSampleSize: marketSearchResults.length,
                channelSampleSize: actualRecentVideos.length,
                allowedSignalSources,
                audienceEvidenceCount,
                watchtowerEvidenceCount,
            },
            outcomeLearning: {
                active: outcomeLearning.active,
                sampleSize: outcomeLearning.sampleSize,
                version: outcomeLearning.version,
            },
        });

    } catch (err) {
        logger.error("[GENERATE_IDEAS_ERROR]", err);
        return NextResponse.json({ error: "Failed to generate ideas." }, { status: 500 });
    }
}
