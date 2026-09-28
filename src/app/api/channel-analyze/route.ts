import { NextRequest, NextResponse } from "next/server";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { getChannelIdFromHandle, getRandomYouTubeApiKey } from "@/lib/youtube-server";
import { resolveUserFromRequest } from "@/lib/resolve-user";
import { deductUserCredits } from "@/db/queries";
import {
    computeChannelMetrics,
    computeKeywordUniqueness,
    computeSEOScore,
    computeGrowthScore,
    getChannelCoverageRatio,
    buildChannelAnalysisPrompt,
    type VideoInput,
    type KeywordMarketContext,
} from "@/lib/engine/channel-prompts";
import {
    fetchMarketData,
    computeMarketSEOScore,
    computeMarketUniquenessScore,
    computeMarketTrendVelocity,
} from "@/lib/engine/market-intelligence";
import { ChannelAnalysisSchema, type ContentCluster } from "@/lib/engine/channel-schemas";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/cors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Node.js runtime is required by the database and token crypto dependencies.
export const runtime = "nodejs";
export const maxDuration = 300; // Fluid Compute: 5 minute max on Vercel Hobby plan

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}

// ─── Input Schema ─────────────────────────────────────────────────────────────

const RequestSchema = z.object({
    channelUrl: z.string().url("Must be a valid YouTube channel URL").refine((value) => {
        const hostname = new URL(value).hostname.toLowerCase();
        return hostname === "youtube.com" || hostname.endsWith(".youtube.com");
    }, "Must be a YouTube channel URL"),
    videos: z.array(z.object({
        title: z.string().min(1).max(300),
        views: z.coerce.number().nonnegative(),
        likes: z.coerce.number().nonnegative().optional().default(0),
        comments: z.coerce.number().nonnegative().optional().default(0),
        uploadDate: z.string().min(1),
        channel: z.string().optional(),
        duration: z.string().optional(),
    })).max(200).optional(),
    channelInfo: z.object({
        name: z.string(),
        subscribers: z.coerce.number()
    }).optional()
});

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const cors = getCorsHeaders(req);

    const apiKey = getRandomYouTubeApiKey();
    if (!apiKey) {
        return NextResponse.json(
            { error: "YouTube API key not configured" },
            { status: 503, headers: cors }
        );
    }

    // Parse input
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
    }

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid request", details: parsed.error.flatten() },
            { status: 400, headers: cors }
        );
    }

    const { channelUrl, videos, channelInfo: scrapedInfo } = parsed.data;

    // ── Auth & Credit Check ──
    const dbUser = await resolveUserFromRequest(req);
    if (!dbUser) {
        return NextResponse.json({ error: "Unauthorized", message: "Please log in to the extension." }, { status: 401, headers: cors });
    }
    if (dbUser.credits < 1) {
        return NextResponse.json({ error: "Insufficient credits", message: "You need at least 1 credit to analyze." }, { status: 402, headers: cors });
    }

    // ── Rate limiting ────────────────────────────────────────────────────────
    const { max, windowMs } = RATE_LIMITS.channelAnalyze;
    const rl = await rateLimit(`channel-analyze:${dbUser.id}`, max, windowMs);
    if (!rl.allowed) {
        return NextResponse.json(
            { error: `Rate limit exceeded. Max ${max} analyses/hour. Retry in ${Math.ceil(rl.resetMs / 60000)} min.` },
            { status: 429, headers: { ...cors, "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } }
        );
    }

    if (!videos || !videos.length || !scrapedInfo) {
        return NextResponse.json(
            { error: "Missing scraped data. Please analyze directly from the channel page using the extension." },
            { status: 400, headers: cors }
        );
    }

    const channelInfo = {
        channelName: scrapedInfo.name,
        handle: new URL(channelUrl).pathname.split("/")[1] || "",
        subscriberCount: scrapedInfo.subscribers,
        totalVideoCount: videos.length,
        description: "Scraped channel analysis"
    };

    const ytVideos = videos.map((v) => ({
        title: String(v.title || ""),
        views: Number(v.views) || 0,
        likes: Number(v.likes) || 0,
        comments: Number(v.comments) || 0,
        uploadDate: String(v.uploadDate || new Date().toISOString()),
        channel: String(v.channel || scrapedInfo.name),
        duration: String(v.duration || "")
    }));

    // ── Convert to VideoInput (channel-prompts compatible) ───────────────────
    const videoInputs: VideoInput[] = ytVideos.map((v) => ({
        title: v.title,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        uploadDate: v.uploadDate,
        channel: v.channel,
        duration: v.duration,
    }));

    // ── Deterministic Pre-scoring ────────────────────────────────────────────
    const metrics = computeChannelMetrics(videoInputs);

    // Top 20 by views for the Groq prompt
    const topVideos = [...videoInputs].sort((a, b) => b.views - a.views);

    // Engagement metrics from the YouTube API data (not available from scraping)
    const totalLikes = ytVideos.reduce((s, v) => s + v.likes, 0);
    const totalComments = ytVideos.reduce((s, v) => s + v.comments, 0);
    const avgLikesPerVideo = Math.round(totalLikes / Math.max(ytVideos.length, 1));
    const avgCommentsPerVideo = Math.round(totalComments / Math.max(ytVideos.length, 1));

    // Build enriched prompt (no market context yet — AI generates keyword candidates first)
    const basePrompt = buildChannelAnalysisPrompt(
        channelInfo.channelName,
        channelUrl,
        metrics,
        topVideos
    );

    // Inject richer stats that only API provides
    const enrichedPrompt = basePrompt.replace(
        "COMPUTED CHANNEL DATA SIGNALS",
        `CHANNEL STATS (from YouTube API — ${ytVideos.length} videos analyzed):
- Subscribers: ${channelInfo.subscriberCount.toLocaleString()}
- Total Videos: ${channelInfo.totalVideoCount.toLocaleString()} (analyzed: ${ytVideos.length})
- Avg Likes/Video: ${avgLikesPerVideo.toLocaleString()}
- Avg Comments/Video: ${avgCommentsPerVideo.toLocaleString()}

COMPUTED CHANNEL DATA SIGNALS`
    );

    // ── Groq AI Analysis ─────────────────────────────────────────────────────
    const keys = [
        process.env.GROQ_API_KEY,
        process.env.GROQ_API_KEY_2,
        process.env.GROQ_API_KEY_3
    ].filter(Boolean) as string[];

    if (keys.length === 0) {
        return NextResponse.json(
            { error: "Groq API keys not configured" },
            { status: 503, headers: cors }
        );
    }


    let rawText: string = "";
    let success = false;
    let lastError: unknown = null;

    const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

    for (const activeKey of shuffledKeys) {
        try {
            const groq = createGroq({ apiKey: activeKey });
            const result = await generateText({
                model: groq("llama3-70b-8192"),
                messages: [
                    {
                        role: "system",
                        content: "You are a JSON API. Respond only with valid JSON matching the exact schema provided. No markdown, no explanation.",
                    },
                    { role: "user", content: enrichedPrompt },
                ],
                maxOutputTokens: 2500,
                temperature: 0.2,
            });
            rawText = result.text;
            success = true;
            break;
        } catch (aiErr: unknown) {
            lastError = aiErr;
            logger.warn("[Key Rotation ChannelAnalyze] Key failed, trying next...");
        }
    }

    if (!success) {
        logger.error("[Channel AI Error] All keys exhausted.", lastError);
        return NextResponse.json(
            { error: "AI service temporarily unavailable. Rate limits exceeded." },
            { status: 503, headers: cors }
        );
    }

    // ── Parse + Validate JSON ────────────────────────────────────────────────
    let parsedOutput: unknown;
    try {
        const start = rawText.indexOf("{");
        const end = rawText.lastIndexOf("}");
        if (start === -1 || end <= start) throw new Error("No JSON found");
        parsedOutput = JSON.parse(rawText.slice(start, end + 1));
    } catch {
        logger.error("[Channel Parse Error] Raw text:", rawText.slice(0, 600));
        return NextResponse.json(
            { error: "AI response format error. Please retry." },
            { status: 502, headers: cors }
        );
    }

    const validation = ChannelAnalysisSchema.safeParse(parsedOutput);
    if (!validation.success) {
        logger.error("[Channel Schema Error]", JSON.stringify(validation.error.flatten(), null, 2));
        logger.error("[Channel Schema] Raw parsed:", JSON.stringify(parsedOutput).slice(0, 800));
        return NextResponse.json(
            { error: "Schema validation failed. Please retry.", details: validation.error.flatten() },
            { status: 502, headers: cors }
        );
    }

    const analysis = validation.data;

    // ── Phase 2: Fetch real YouTube market data for each AI-suggested keyword ──
    // Run all keyword market fetches in parallel (fire-and-forget gracefully)
    const marketDataMap = new Map<string, KeywordMarketContext>();
    try {
        const marketFetches = analysis.keywords.map(async (kw) => {
            const data = await fetchMarketData(kw.keyword, apiKey, 10);
            if (data) {
                marketDataMap.set(kw.keyword, {
                    keyword: kw.keyword,
                    collectedAt: data.collectedAt,
                    avgViews: data.avgViews,
                    avgCompetitorSubscribers: data.avgCompetitorSubscribers,
                    recentUploadRate: data.recentUploadRate,
                    lowCompetitionCount: data.lowCompetitionCount,
                    topTitles: data.topTitles,
                    resultCount: data.resultCount,
                    maxViews: data.maxViews,
                });
            }
        });
        await Promise.all(marketFetches);
        logger.debug(`[ChannelAnalyze] Market data fetched for ${marketDataMap.size}/${analysis.keywords.length} keywords`);
    } catch (marketErr) {
        logger.warn("[ChannelAnalyze] Market data fetch failed — falling back to heuristics", marketErr);
    }

    // ── Post-process: scores from real market data, fallback to heuristics ────
    // Channel-level growth baseline (velocity + engagement + trend)
    const channelGrowthBase = computeGrowthScore(
        metrics.viewVelocity,
        avgLikesPerVideo,
        avgCommentsPerVideo,
        metrics.averageViews,
        metrics.recentTrend
    );

    const enrichedKeywords = analysis.keywords.map((kw) => {
        const marketCtx = marketDataMap.get(kw.keyword);
        const coverageRatio = getChannelCoverageRatio(kw.keyword, metrics.topicUniqueness, metrics.totalVideos);

        // SEO: prefer real market score, fall back to structural heuristic
        const seo = marketCtx ? computeMarketSEOScore(marketCtx) : computeSEOScore(kw.keyword);

        // Uniqueness: prefer market demand vs channel gap, fall back to channel-only
        const uniqueness = marketCtx
            ? computeMarketUniquenessScore(marketCtx, coverageRatio)
            : computeKeywordUniqueness(kw.keyword, metrics.topicUniqueness, metrics.totalVideos);

        // trendingAcceleration: real market trend velocity when available
        const trendingAcceleration = marketCtx
            ? computeMarketTrendVelocity(marketCtx)
            : (metrics.recentTrend === "growing" ? 70 : metrics.recentTrend === "stable" ? 45 : 20);

        // Per-keyword growthScore: blend channel baseline with this keyword's market momentum
        // This ensures each keyword has a genuinely different growth score
        const keywordGrowthScore = marketCtx
            ? Math.round(channelGrowthBase * 0.55 + trendingAcceleration * 0.45)
            : channelGrowthBase;

        // trendingAcceleration is already baked into keywordGrowthScore (45% weight),
        // so including it again double-counts the trend signal (~10pt inflation).
        const gap = Math.min(100, Math.round(seo * 0.40 + keywordGrowthScore * 0.30 + uniqueness * 0.30));

        return {
            ...kw,
            seoScore: seo,
            growthScore: keywordGrowthScore,
            uniquenessScore: uniqueness,
            gapScore: gap,
            // Expose market signals in the response
            marketData: marketCtx ? {
                avgCompetitorViews: marketCtx.avgViews,
                avgCompetitorSubscribers: marketCtx.avgCompetitorSubscribers,
                trendVelocity: trendingAcceleration,
                weakCompetitorCount: marketCtx.lowCompetitionCount,
            } : null,
        };
    });


    // ── Validate competitor handles + compute topicOverlap deterministically ──
    // Overlap = how many of this channel's dominant keywords appear in the competitor's name/reason
    const channelTopWords = new Set(
        [...metrics.topicUniqueness.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([w]) => w.toLowerCase())
    );
    const verifiedCompetitors = await Promise.all(analysis.competitors
        .filter((c) => /^@[a-zA-Z0-9_.\-]{2,}$/.test(c.handle))
        .map(async (c) => {
            const resolvedChannelId = await getChannelIdFromHandle(c.handle, apiKey).catch(() => null);
            if (!resolvedChannelId) return null;
            // Count how many channel topic words appear in competitor handle + reason text
            const competitorText = `${c.handle} ${c.name ?? ""} ${c.reason}`.toLowerCase()
                .replace(/[^a-z0-9\s]/g, " ");
            const competitorWords = new Set(competitorText.split(/\s+/).filter(w => w.length > 2));
            const overlapCount = [...channelTopWords].filter(w => competitorWords.has(w)).length;
            // Normalize: 0 matching words = 20% (different niches but related), 5+ words = 90%
            const topicOverlap = Math.min(90, Math.max(20, Math.round(20 + overlapCount * 14)));
            return { ...c, topicOverlap, verified: true, resolvedChannelId };
        }));
    const validCompetitors = verifiedCompetitors.filter((competitor): competitor is NonNullable<typeof competitor> => competitor !== null);

    logger.info(`[ChannelAnalyze] user ${dbUser.id} analyzed ${channelInfo.channelName} (${ytVideos.length} videos)`);

    // Compute additional analytics
    const avgLikeRate = avgLikesPerVideo / Math.max(metrics.averageViews, 1);
    const avgCommentRate = avgCommentsPerVideo / Math.max(metrics.averageViews, 1);

    // Revenue estimation — gated behind minimum views to avoid misleading small channels
    const MIN_VIEWS_FOR_REVENUE = 5_000;
    // Use only recent videos (last 90 days) for the monthly base — avoids inflation
    // from one old viral video skewing the lifetime average (e.g., 1 video with 10M views
    // pulling the avg up even though recent videos get 10K views each).
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recentVideos = ytVideos.filter(v => new Date(v.uploadDate).getTime() > ninetyDaysAgo);
    const recentAvgViews = recentVideos.length >= 3
        ? recentVideos.reduce((s, v) => s + v.views, 0) / recentVideos.length
        : metrics.averageViews; // Fall back to all-time avg if < 3 recent videos
    const estimatedMonthlyViews = Math.round(recentAvgViews * metrics.postsPerWeek * 4);
    const cpmRange = analysis.niche.toLowerCase().includes("finance") ? { low: 12, high: 45 }
        : analysis.niche.toLowerCase().includes("tech") || analysis.niche.toLowerCase().includes("ai") ? { low: 8, high: 25 }
        : analysis.niche.toLowerCase().includes("analytics") || analysis.niche.toLowerCase().includes("data") ? { low: 7, high: 22 }
        : analysis.niche.toLowerCase().includes("programming") || analysis.niche.toLowerCase().includes("code") ? { low: 8, high: 22 }
        : { low: 3, high: 12 };

    const monetizedViewRate = 0.45;
    const creatorShare = 0.55;
    const revenueAvailable = metrics.averageViews >= MIN_VIEWS_FOR_REVENUE;
    const monthlyRevenueLow = revenueAvailable
        ? Math.round((estimatedMonthlyViews * monetizedViewRate / 1000) * cpmRange.low * creatorShare)
        : null;
    const monthlyRevenueHigh = revenueAvailable
        ? Math.round((estimatedMonthlyViews * monetizedViewRate / 1000) * cpmRange.high * creatorShare)
        : null;

    // Upload schedule analysis
    const uploadDays: Record<string, number> = {};
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (const v of ytVideos) {
        const uploadDate = new Date(v.uploadDate);
        if (Number.isNaN(uploadDate.getTime())) continue;
        const day = DAYS[uploadDate.getUTCDay()];
        uploadDays[day] = (uploadDays[day] ?? 0) + 1;
    }
    const bestUploadDay = Object.entries(uploadDays).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

    // Top performing video analysis
    const topPerformers = [...ytVideos]
        .sort((a, b) => b.views - a.views)
        .slice(0, 5)
        .map(v => ({
            title: v.title,
            views: v.views,
            likes: v.likes,
            likeRate: v.views > 0 ? ((v.likes / v.views) * 100).toFixed(2) : "0",
            uploadDate: v.uploadDate,
        }));

    // Enrich contentOpportunityGaps trendingAcceleration with real market data
    // Use smarter search queries = clusterName + channel's top keyword for context precision
    let enrichedGaps = analysis.contentOpportunityGaps ?? [];
    const topChannelTopic = [...metrics.topicUniqueness.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([w]) => w)
        .join(" ");

    try {
        const gapFetches = enrichedGaps.map(async (gap: ContentCluster) => {
            const clusterKey = gap.clusterName;
            if (!clusterKey || !apiKey) return gap;

            // Build a more specific search query by combining cluster with the channel's real niche
            const searchQuery = `${clusterKey} ${topChannelTopic}`.substring(0, 100).trim();
            const marketData = await fetchMarketData(searchQuery, apiKey, 8).catch(() => null);

            if (marketData) {
                const baseVelocity = computeMarketTrendVelocity(marketData);
                const sampleCompetitionGap = marketData.resultCount > 0
                    ? Math.round((marketData.lowCompetitionCount / marketData.resultCount) * 100)
                    : 0;
                const opportunityIndex = Math.round(baseVelocity * 0.55 + sampleCompetitionGap * 0.45);

                return {
                    ...gap,
                    trendingAcceleration: baseVelocity,
                    opportunityIndex,
                    marketSignal: {
                        avgViews: marketData.avgViews,
                        competition: marketData.avgCompetitorSubscribers > 1_000_000 ? "High"
                            : marketData.avgCompetitorSubscribers > 100_000 ? "Medium" : "Low",
                        recentUploadRate: marketData.recentUploadRate,
                        sampleSize: marketData.resultCount,
                        measuredAt: marketData.collectedAt,
                    },
                };
            }

            return {
                ...gap,
                trendingAcceleration: 0,
                opportunityIndex: 0,
                marketSignal: null,
                dataStatus: "Insufficient current public market data",
            };
        });
        enrichedGaps = await Promise.all(gapFetches);
        logger.debug(`[ChannelAnalyze] Enriched ${enrichedGaps.length} content opportunity gaps with market data`);
    } catch {
        // Never preserve AI-generated numeric market claims after a failed lookup.
        enrichedGaps = enrichedGaps.map((gap) => ({
            ...gap,
            trendingAcceleration: 0,
            opportunityIndex: 0,
            marketSignal: null,
            dataStatus: "Current public market lookup failed",
        }));
    }

    // Charge only after the response has passed validation and grounding.
    const chargedUser = await deductUserCredits(dbUser.id, 1, "Extension Channel Analysis");
    if (!chargedUser) {
        return NextResponse.json({ error: "Insufficient credits", message: "Your available credit was used by another request." }, { status: 402, headers: cors });
    }


    return NextResponse.json(
        {
            success: true,
            channel: {
                name: channelInfo.channelName,
                url: channelUrl,
                handle: channelInfo.handle,
                subscribers: channelInfo.subscriberCount,
                totalVideos: channelInfo.totalVideoCount,
                description: channelInfo.description,
            },
            metrics: {
                viewVelocity: metrics.viewVelocity,
                uploadConsistency: metrics.uploadConsistency,
                hitRate: metrics.hitRate,
                recentTrend: metrics.recentTrend,
                postsPerWeek: metrics.postsPerWeek,
                averageViews: metrics.averageViews,
                totalVideos: ytVideos.length,
                avgLikesPerVideo,
                avgCommentsPerVideo,
                avgLikeRate: parseFloat((avgLikeRate * 100).toFixed(3)),
                avgCommentRate: parseFloat((avgCommentRate * 100).toFixed(4)),
                engagementScore: metrics.engagementScore,
            },
            revenue: revenueAvailable ? {
                estimatedMonthlyViews,
                monthlyRevenueLow,
                monthlyRevenueHigh,
                cpmRange,
                note: "Illustrative advertising scenario only; this is not observed channel revenue. Actual RPM, monetized playback rate, geography, and eligibility are unavailable.",
            } : {
                estimatedMonthlyViews: null,
                monthlyRevenueLow: null,
                monthlyRevenueHigh: null,
                cpmRange: null,
                note: `Insufficient data — channel averages under ${MIN_VIEWS_FOR_REVENUE.toLocaleString()} views/video. Grow your audience first for reliable estimates.`,
            },
            uploadSchedule: {
                bestDay: bestUploadDay,
                dayDistribution: uploadDays,
                currentFrequency: `${metrics.postsPerWeek} videos/week`,
                note: "Most common observed publishing day in the supplied sample; not a proven best time or audience-activity measurement.",
            },
            topPerformers,
            niche: analysis.niche,
            summary: analysis.summary,
            keywords: enrichedKeywords,
            competitors: validCompetitors,
            topPatterns: analysis.topPatterns,
            contentOpportunityGaps: enrichedGaps,
            growthActions: analysis.growthActions ?? [],
        },
        { status: 200, headers: cors }
    );
}
