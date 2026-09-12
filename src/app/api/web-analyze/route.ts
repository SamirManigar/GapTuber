import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { auth } from "@/auth";
import { db } from "@/db";

import { getRandomYouTubeApiKey } from "@/lib/youtube-server";
import { scans, outlierDetections, trackedVideos } from "@/db/schema";
import { getUserByEmail, getChannelById, deductUserCredits } from "@/db/queries";
import { inngest } from "@/inngest/client";
import { OUTLIER_CONFIG } from "@/lib/engine/config";
import {
    buildGapCandidates,
    computeVelocityScore,
    computeSaturationScore,
    computeFrustrationScore,
    computeEngagementScore,
    computeTrendMomentum,
    computeCompetitionScore,
    computeOptimalUploadSchedule,
    estimateRevenue,
    generateOptimalTags,
    VideoData,
    CommentData,
} from "@/lib/engine/scoring";
import { buildAnalysisPrompt } from "@/lib/engine/prompts";
import { GapOutputSchema } from "@/lib/engine/schemas";
import { buildAnalysisProvenance } from "@/lib/engine/provenance";
import { getChannelIdFromHandle, getRecentChannelVideos, getSearchResults, getTopComments } from "@/lib/youtube-server";
import { enrichWithDislikes } from "@/lib/engine/dislike-enricher";
import { searchCaptionGaps, buildFilmotContext } from "@/lib/filmot";
import { groundWithExa } from "@/lib/ai-grounding";
import { z } from "zod";

export const maxDuration = 60; // Vercel Hobby plan max for streaming/Next.js config

const WebAnalyzeRequestSchema = z.object({
    keyword: z.string().min(2).max(100).trim(),
    competitors: z.array(z.string()).min(1).max(3),
    channelId: z.string().uuid(), // The ID of the current GapTuber channel to save against
});



export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Rate limit: 10 messages per hour per user
        const { max, windowMs } = RATE_LIMITS.webAnalyze;
        const rl = await rateLimit(`web-analyze:${session.user.email}`, max, windowMs);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: `Rate limit exceeded. Max ${max} analysis/hour. Try again in ${Math.ceil(rl.resetMs / 60000)} min.` },
                { status: 429 }
            );
        }

        const body = await req.json();
        const parseResult = WebAnalyzeRequestSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({ error: "Invalid request data.", details: parseResult.error.flatten() }, { status: 400 });
        }

        const { keyword, competitors, channelId } = parseResult.data;
        const dbUser = await getUserByEmail(session.user.email);
        if (!dbUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        if (dbUser.credits < 1) {
            return NextResponse.json({ error: "Insufficient credits. Please upgrade your plan." }, { status: 402 });
        }

        const ownedChannel = await getChannelById(channelId);
        if (!ownedChannel || ownedChannel.userId !== dbUser.id) {
            return NextResponse.json({ error: "Channel not found" }, { status: 404 });
        }

        const apiKey = getRandomYouTubeApiKey();

        if (!apiKey) {
            return NextResponse.json({ error: "YouTube API Key is missing." }, { status: 500 });
        }

        // 1. Fetch YouTube Data
        let videos: VideoData[] = [];
        const comments: CommentData[] = [];
        let competitorsResolved = 0;
        
        for (const competitor of competitors) {
            const ytChannelId = await getChannelIdFromHandle(competitor, apiKey);
            if (ytChannelId) {
                const recentVideos = await getRecentChannelVideos(ytChannelId, apiKey, 10);
                if (recentVideos.length > 0) competitorsResolved += 1;
                videos = [...videos, ...recentVideos];
            }
        }

        // Deduplicate videos
        videos = Array.from(new Map(videos.map(v => [v.url, v])).values());

        // ─── Waterfall Outlier Search Engine 2.0 (Dual-Pass + Channel Lift) ───
        let searchResults: any[] = [];
        let outlierFound = false;
        
        const parseDuration = (isoStr?: string) => {
            if (!isoStr) return 0;
            const match = isoStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (!match) return 0;
            return (parseInt(match[1] || "0") * 3600) + (parseInt(match[2] || "0") * 60) + parseInt(match[3] || "0");
        };

        const calculateRelevance = (title: string, description: string, kw: string) => {
            const t = title.toLowerCase();
            const d = (description || "").toLowerCase();
            const k = kw.toLowerCase();
            
            const titleSimilarity = t.includes(k) ? 1.0 : k.split(' ').some(w => t.includes(w)) ? 0.5 : 0;
            const descriptionSimilarity = d.includes(k) ? 1.0 : k.split(' ').some(w => d.includes(w)) ? 0.5 : 0;
            
            const kwWords = k.split(' ').filter(w => w.length > 2);
            let matchCount = 0;
            const fullText = `${t} ${d}`;
            for (const w of kwWords) {
                if (fullText.includes(w)) matchCount++;
            }
            const keywordCoverage = kwWords.length > 0 ? matchCount / kwWords.length : 0;

            return (titleSimilarity * 0.55) + (descriptionSimilarity * 0.25) + (keywordCoverage * 0.20);
        };

        const executeWaterfallPass = async (daysAgo: number) => {
            const dateFilter = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
            const [resRelevance, resDate] = await Promise.all([
                getSearchResults(keyword, apiKey, 50, dateFilter, "relevance"),
                getSearchResults(keyword, apiKey, 50, dateFilter, "date")
            ]);
            
            // Merge & Deduplicate
            const combinedMap = new Map();
            for (const r of [...resRelevance, ...resDate]) {
                if (!combinedMap.has(r.title)) {
                    const longFormEligible = parseDuration(r.duration) >= OUTLIER_CONFIG.longFormMinSeconds;
                    const relevanceScore = calculateRelevance(r.title, r.description || "", keyword);
                    
                    if (longFormEligible && relevanceScore >= OUTLIER_CONFIG.relevanceThreshold) {
                        combinedMap.set(r.title, { ...r, relevance: relevanceScore });
                    }
                }
            }
            return Array.from(combinedMap.values());
        };

        // 1. Pass A & B: Last 24 Hours
        let results = await executeWaterfallPass(1);

        // Define what makes a "Potential Outlier" to investigate for Channel Lift
        const findPotentialOutliers = (items: any[]) => {
            const ranked = items.map(r => {
                const ageHours = Math.max(0.1, (Date.now() - new Date(r.uploadDate).getTime()) / (1000 * 60 * 60));
                const adjustedAgeHours = Math.max(ageHours, 2);
                const averagePace = r.views / adjustedAgeHours;
                const viewsPerDay = r.views / Math.max(1, ageHours / 24);
                // relevance is already calculated in executeWaterfallPass
                return { ...r, ageHours, averagePace, viewsPerDay };
            });
            
            // Normalize for pacePercentile BEFORE filtering
            const maxPace = Math.max(...ranked.map(r => r.averagePace), 1);

            const filtered = ranked.map(r => {
                const pacePercentile = (r.averagePace / maxPace) * 100;
                return { ...r, pacePercentile };
            }).filter(r => r.views >= 200 && (r.pacePercentile >= 80 || r.viewsPerDay >= 500));

            if (filtered.length === 0) return [];

            const maxViews = Math.max(...filtered.map(r => r.views), 1);
            
            return filtered.map(r => {
                const viewScore = r.views / maxViews;
                const paceScore = r.pacePercentile / 100;
                const freshnessScore = Math.max(0, 1 - (r.ageHours / (7 * 24))); // newer = higher
                
                const outlierScore = (paceScore * 0.55) + (viewScore * 0.25) + (freshnessScore * 0.20);
                return { ...r, outlierScore };
            }).sort((a, b) => b.outlierScore - a.outlierScore);
        };

        let potentialOutliers = findPotentialOutliers(results);

        // Early Exit: Only stop the waterfall if we found enough QUALIFIED videos
        if (results.length < OUTLIER_CONFIG.minQualifiedResults) {
            // 2. Pass C & D: Fallback to 7 Days
            const results7d = await executeWaterfallPass(7);
            results = [...results, ...results7d]; // Keep 24h as well
            
            // Deduplicate again
            const finalMap = new Map();
            for (const r of results) finalMap.set(r.title, r);
            results = Array.from(finalMap.values());
            
            potentialOutliers = findPotentialOutliers(results);
        }

        if (results.length === 0) {
            // 3. Absolute Fallback: All Time (Relevance only)
            const allTime = await getSearchResults(keyword, apiKey, 50);
            results = allTime
                .filter(r => {
                    const longFormEligible = parseDuration(r.duration) >= OUTLIER_CONFIG.longFormMinSeconds;
                    const relevanceScore = calculateRelevance(r.title, r.description || "", keyword);
                    return longFormEligible && relevanceScore >= OUTLIER_CONFIG.relevanceThreshold;
                })
                .map(r => ({ ...r, relevance: calculateRelevance(r.title, r.description || "", keyword) }));
        }
        
        searchResults = results;

        // ─── Calculate Channel Lift for Top 3 Potential Outliers ───
        // We do this here instead of scoring.ts to parallelize API calls and save quota
        const relevantOutliers = potentialOutliers.slice(0, OUTLIER_CONFIG.deepCandidateCount);

        const channelLiftData: Record<string, { lift: number; confidence: string; candidateViews: number; ageHours: number }> = {};
        
        await Promise.all(relevantOutliers.map(async (outlier) => {
            if (!outlier.channelId) return;
            // Uses efficient playlist API, not search API
            const recentVideos = await getRecentChannelVideos(outlier.channelId, apiKey, 15);
            
            // Filter candidate itself, Shorts, and videos < 7 days old
            const eligibleVideos = recentVideos.filter(v => {
                const longFormEligible = parseDuration(v.duration) >= OUTLIER_CONFIG.longFormMinSeconds;
                const isMature = (Date.now() - new Date(v.uploadDate).getTime()) > (7 * 24 * 60 * 60 * 1000);
                return v.title !== outlier.title && longFormEligible && isMature;
            });
            
            if (eligibleVideos.length >= 3) {
                // Calculate median views
                const sortedViews = eligibleVideos.map(v => v.views).sort((a, b) => a - b);
                const mid = Math.floor(sortedViews.length / 2);
                const medianViews = sortedViews.length % 2 !== 0 ? sortedViews[mid] : (sortedViews[mid - 1] + sortedViews[mid]) / 2;
                
                if (medianViews > 0) {
                    const lift = outlier.views / medianViews;
                    let confidence = "Low";
                    if (eligibleVideos.length >= 8) confidence = "High";
                    else if (eligibleVideos.length >= 5) confidence = "Medium";

                    channelLiftData[outlier.channelId] = { 
                        lift, 
                        confidence, 
                        candidateViews: outlier.views, 
                        ageHours: outlier.ageHours 
                    };
                }
            }
        }));

        // Fetch comments for the top 3 outlier candidates and the top relevant baseline
        const candidateUrls = relevantOutliers.map(o => `https://www.youtube.com/watch?v=${o.videoId}`);
        const baselineUrl = videos.length > 0 ? videos[0].url : "";
        const urlsToFetch = [...new Set([...candidateUrls, baselineUrl])].filter(Boolean);
        
        for (const url of urlsToFetch) {
            const videoId = url.split("v=")[1];
            if (videoId) {
                const videoComments = await getTopComments(videoId, apiKey, 5);
                comments.push(...videoComments.map(c => ({ ...c, videoUrl: url })));
            }
        }

        if (videos.length === 0 && searchResults.length === 0) {
            return NextResponse.json({ error: "Could not fetch any YouTube data for the provided inputs." }, { status: 404 });
        }

        // 1b. Parallel enrichment — fire all optional signals concurrently
        const [enrichedVideos, filmotResults, exaContext] = await Promise.all([
            enrichWithDislikes(videos),
            searchCaptionGaps(keyword),
            groundWithExa(keyword),
        ]);
        videos = enrichedVideos;

        // 2. Deterministic Scoring
        const evidencePool = [...comments]
            .map(comment => ({ ...comment, id: comment.id ?? crypto.randomUUID() }))
            .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
            .slice(0, 30);

        const candidates = buildGapCandidates({ keyword, videos, comments: evidencePool, searchResults, channelLiftData });

        const velocityData = computeVelocityScore(videos);
        const saturationData = computeSaturationScore(searchResults);
        const frustrationData = computeFrustrationScore(evidencePool);
        const engagementData = computeEngagementScore(videos);
        const trendData = computeTrendMomentum(videos);
        const competitionData = computeCompetitionScore(searchResults);
        const scheduleData = computeOptimalUploadSchedule(videos);
        const suggestedTags = generateOptimalTags(keyword, videos, frustrationData.topKeywords);

        // Tier 2A: Extract competitor titles and verbatim pain points for LLM differentiation
        const competitorTitles = searchResults.map(r => r.title).filter(Boolean);
        const promptComments = evidencePool.map(comment => ({
            id: comment.id,
            text: comment.text.trim().slice(0, 300),
            likes: comment.likeCount ?? 0,
        }));
        const whyNowContext = `Sample collected now from the YouTube Data API: ${videos.length} competitor videos, ${searchResults.length} keyword search results, and ${evidencePool.length} top-level comments. Recent-performance score: ${trendData.score.toFixed(1)}/10 (${trendData.insight})`;
        const filmotContext = buildFilmotContext(filmotResults, keyword);
        const prompt = buildAnalysisPrompt(keyword, candidates, competitorTitles, promptComments, whyNowContext + filmotContext + exaContext);

        // 3. AI Refinement
        const keys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3].filter(Boolean) as string[];
        if (keys.length === 0) {
            return NextResponse.json({ error: "Groq API keys not configured." }, { status: 503 });
        }

        let rawAiText = "";
        let aiSuccess = false;
        const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

        for (const activeKey of shuffledKeys) {
            try {
                const groq = createGroq({ apiKey: activeKey });
                const result = await generateText({
                    model: groq("openai/gpt-oss-120b"),
                    messages: [
                        { role: "system", content: "You are a JSON API. Respond with only valid JSON, no markdown." },
                        { role: "user", content: prompt },
                    ],
                    maxOutputTokens: 1500,
                    temperature: 0.2,
                });
                rawAiText = result.text;
                aiSuccess = true;
                break;
            } catch (err) {
                console.warn("[Web Analyze AI Error]", err);
            }
        }

        if (!aiSuccess) {
            return NextResponse.json({ error: "AI service error." }, { status: 503 });
        }

        // 4. Parse Output
        let parsedOutput: unknown;
        try {
            const start = rawAiText.indexOf("{");
            const end = rawAiText.lastIndexOf("}");
            if (start === -1 || end <= start) throw new Error("No JSON object found");
            parsedOutput = JSON.parse(rawAiText.slice(start, end + 1));
        } catch {
            return NextResponse.json({ error: "AI returned invalid JSON." }, { status: 502 });
        }

        const validationResult = GapOutputSchema.safeParse(parsedOutput);
        if (!validationResult.success) {
            return NextResponse.json({ error: "AI output schema validation failed." }, { status: 502 });
        }

        let scanResult = validationResult.data;

        const avgViews = videos.length > 0 ? videos.reduce((s, v) => s + v.views, 0) / videos.length : 10000;
        const revenueEstimate = estimateRevenue(avgViews, keyword);

        const provenance = buildAnalysisProvenance({
            competitorsRequested: competitors.length,
            competitorsResolved,
            videos: videos.length,
            comments: evidencePool.length,
            searchResults: searchResults.length,
            dataConfidence: candidates[0]?.scores.confidence ?? 0,
        });

        const analyticsPayload = {
            velocity: { score: velocityData.score, insight: velocityData.insight, weeklyGrowthRate: velocityData.weeklyGrowthRate },
            saturation: { score: saturationData.score, insight: saturationData.insight, competitionLevel: saturationData.competitionLevel },
            frustration: { score: frustrationData.score, topKeywords: frustrationData.topKeywords, painPoints: frustrationData.painPoints, sentimentBreakdown: frustrationData.sentimentBreakdown },
            engagement: { score: engagementData.score, avgLikeRate: engagementData.avgLikeRate, avgCommentRate: engagementData.avgCommentRate },
            trend: { score: trendData.score, trend: trendData.trend, insight: trendData.insight },
            competition: { score: competitionData.score, difficulty: competitionData.difficulty, insight: competitionData.insight },
            uploadSchedule: { bestDay: scheduleData.bestDay, bestHour: scheduleData.bestHour, insight: scheduleData.insight },
            revenueEstimate: { low: revenueEstimate.low, mid: revenueEstimate.mid, high: revenueEstimate.high },
            suggestedTags: suggestedTags.slice(0, 20),
            provenance,
        };

        const structuredReasons = [
            { type: "velocity", label: "Recent performance delta", value: (velocityData.weeklyGrowthRate ?? 0) > 0 ? "+" + Math.round(velocityData.weeklyGrowthRate ?? 0) + "%" : Math.round(velocityData.weeklyGrowthRate ?? 0) + "%", source: "youtube_video_sample" },
            { type: "saturation", label: "Competition", value: saturationData.competitionLevel ?? "Unknown", source: "saturation" },
            { type: "sample", label: "Evidence sample", value: `${videos.length} videos · ${evidencePool.length} comments`, source: "youtube_data_api" },
            ...(filmotResults.length > 0 ? [{ type: "caption", label: "Caption signal", value: `${filmotResults.length} videos speak about this topic in transcripts`, source: "filmot" }] : []),
            ...(exaContext ? [{ type: "web", label: "Web grounding", value: "Current web context verified via Exa", source: "exa" }] : []),
        ];

        scanResult = {
            ...scanResult,
            gaps: scanResult.gaps.map((gap, index) => {
                const candidate = candidates[index] ?? candidates[0];
                const evidenceComments = (gap.evidenceComments ?? [])
                    .map(evidence => evidencePool.find(comment => comment.id === evidence.commentId))
                    .filter((comment): comment is typeof evidencePool[number] => Boolean(comment))
                    .map(comment => ({ commentId: comment.id, text: comment.text, likes: comment.likeCount ?? 0 }));

                return {
                    ...gap,
                    id: crypto.randomUUID(),
                    gapScore: candidate?.scores.compositeScore ?? 0,
                    confidence: candidate?.scores.confidence ?? 0,
                    evidenceComments,
                    quantitativeReasons: structuredReasons,
                };
            })
        };

        // Charge only after the model response is parsed, validated, and grounded.
        await deductUserCredits(dbUser.id, 1, "Web Competitor Analysis");

        // 6. Save to DB
        const scanId = crypto.randomUUID();
        try {
                await db.insert(scans).values({
                    id: scanId,
                    userId: dbUser.id,
                    channelId,
                    keyword,
                    competitors,
                    rawData: {
                        videoCount: videos.length,
                        commentCount: comments.length,
                        searchResultCount: searchResults.length,
                        candidateScores: candidates.map((c) => ({ title: c.title, score: c.scores.compositeScore })),
                    },
                    result: scanResult,
                    analytics: analyticsPayload,
                });
        } catch (dbError) {
            console.error("[Web Analyze DB Error]", dbError);
        }

        // 7. Track Outliers via Inngest
        for (const outlier of relevantOutliers) {
            if (!outlier.id) continue;
            
            const liftStats = channelLiftData[outlier.channelId || ""] || { lift: 1.0 };
            const classification = outlier.outlierScore > 0.8 ? "BREAKOUT" : "EMERGING";
            
            try {
                // Insert into outlier_detections
                await db.insert(outlierDetections).values({
                    searchRunId: scanId,
                    videoId: outlier.id,
                    keyword,
                    relevanceScore: outlier.relevance,
                    pacePercentile: outlier.pacePercentile,
                    channelLift: liftStats.lift,
                    classification: classification,
                    engineVersion: OUTLIER_CONFIG.collectorVersion,
                });
                
                // Add to trackedVideos (idempotent due to unique videoId)
                const trackedResult = await db.insert(trackedVideos).values({
                    videoId: outlier.id,
                    firstDetectedAt: new Date(),
                    trackingStartedAt: new Date(),
                    trackingExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                    status: "ACTIVE",
                    priority: classification === "BREAKOUT" ? "BREAKOUT_CANDIDATE" : "EMERGING",
                }).onConflictDoNothing().returning({ id: trackedVideos.id });
                
                if (trackedResult.length > 0) {
                    // This means it's a completely new video being tracked, so we fire the inngest workflow
                    await inngest.send({
                        name: "engine/outlier.detected",
                        data: {
                            videoId: outlier.id,
                            trackingId: trackedResult[0].id,
                            detectedAt: new Date().toISOString(),
                            searchRunId: scanId,
                        }
                    });
                }
            } catch (trackerErr) {
                console.error("[Inngest Tracking Error]", trackerErr);
            }
        }

        return NextResponse.json({
            success: true,
            keyword,
            gaps: scanResult.gaps,
            overallOpportunity: scanResult.overallOpportunity,
            recommendedNiche: scanResult.recommendedNiche,
            analytics: analyticsPayload,
            scanId,
        });

    } catch (error) {
        console.error("[Web Analyze Error]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
