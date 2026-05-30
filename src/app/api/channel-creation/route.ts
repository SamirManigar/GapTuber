import { NextRequest, NextResponse } from "next/server";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import {
    computeMarketIntelligence,
    generateOptimalTags,
    type VideoData,
    type SearchResult,
} from "@/lib/engine/scoring";
import { getCorsHeaders } from "@/lib/cors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const maxDuration = 300; // Fluid Compute: 5 minute max on Vercel Hobby plan

const YT_BASE = "https://www.googleapis.com/youtube/v3";

const RequestSchema = z.object({
    category: z.string().min(1).max(50).default("general"),
    topic: z.string().min(2).max(150).trim(),
});

// ─── YouTube Search for Market Data ──────────────────────────────────────────

async function searchYouTubeForTopic(
    apiKey: string,
    topic: string,
    maxResults = 25
): Promise<{ videos: VideoData[]; searchResults: SearchResult[] }> {
    // Step 1: Search for video IDs
    const searchUrl = `${YT_BASE}/search?part=snippet&q=${encodeURIComponent(topic)}&type=video&order=relevance&maxResults=${maxResults}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);

    if (!searchRes.ok) {
        const err = await searchRes.json() as { error?: { code: number; message: string } };
        if (err.error?.code === 403) throw new Error("QUOTA_EXCEEDED");
        throw new Error(`YouTube search failed: ${err.error?.message ?? searchRes.statusText}`);
    }

    const searchData = await searchRes.json() as {
        items?: Array<{
            id: { videoId: string };
            snippet: { title: string; channelTitle: string; publishedAt: string };
        }>;
    };

    const videoIds = (searchData.items ?? []).map(item => item.id.videoId);
    if (videoIds.length === 0) return { videos: [], searchResults: [] };

    // Step 2: Get full video stats and channel IDs
    const statsUrl = `${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);

    if (!statsRes.ok) return { videos: [], searchResults: [] };

    const statsData = await statsRes.json() as {
        items?: Array<{
            id: string;
            snippet: { title: string; channelId: string; channelTitle: string; publishedAt: string; description?: string; tags?: string[] };
            statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
            contentDetails: { duration?: string };
        }>;
    };

    const channelIds = Array.from(new Set((statsData.items ?? []).map(item => item.snippet.channelId)));
    
    // Step 3: Get channel stats (subscriber count) for outliers detection
    const channelUrl = `${YT_BASE}/channels?part=statistics&id=${channelIds.join(",")}&key=${apiKey}`;
    const channelRes = await fetch(channelUrl);
    const channelStatsMap: Record<string, number> = {};
    
    if (channelRes.ok) {
        const channelData = await channelRes.json();
        (channelData.items || []).forEach((c: any) => {
            channelStatsMap[c.id] = parseInt(c.statistics?.subscriberCount || "0");
        });
    }

    const videos: VideoData[] = (statsData.items ?? []).map(item => ({
        title: item.snippet.title,
        views: parseInt(item.statistics.viewCount || "0"),
        likes: parseInt(item.statistics.likeCount || "0"),
        comments: parseInt(item.statistics.commentCount || "0"),
        uploadDate: item.snippet.publishedAt,
        url: `https://youtube.com/watch?v=${item.id}`,
        channel: item.snippet.channelTitle,
        duration: item.contentDetails.duration || "PT0S",
        tags: item.snippet.tags,
        description: item.snippet.description?.slice(0, 200),
    }));

    const searchResults: SearchResult[] = (statsData.items ?? []).map(item => ({
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        views: parseInt(item.statistics.viewCount || "0"),
        likes: parseInt(item.statistics.likeCount || "0"),
        uploadDate: item.snippet.publishedAt,
        subscriberCount: channelStatsMap[item.snippet.channelId] ?? 0,
    }));

    return { videos, searchResults };
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const cors = getCorsHeaders(req);
    try {
        // ── Auth guard ────────────────────────────────────────────────────────
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
        }

        // ── Input validation ─────────────────────────────────────────────────
        let body: unknown;
        try { body = await req.json(); } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
        }

        const parsed = RequestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400, headers: cors });
        }

        const { category, topic } = parsed.data;

        // ── Rate limiting ───────────────────────────────────────────────────
        const { max, windowMs } = RATE_LIMITS.channelCreation;
        const rl = await rateLimit(`channel-creation:${session.user.email}`, max, windowMs);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: `Rate limit exceeded. You can run ${max} analyses per hour. Try again in ${Math.ceil(rl.resetMs / 60000)} min.` },
                { status: 429, headers: { ...cors, "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } }
            );
        }

        const youtubeKeys = [
            process.env.YOUTUBE_API_KEY,
            process.env.YOUTUBE_API_KEY_2,
            process.env.YOUTUBE_API_KEY_3,
        ].filter(Boolean) as string[];

        const hasGroqKey = process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY_3;
        if (!hasGroqKey) {
            return NextResponse.json({ error: "AI service not configured" }, { status: 503, headers: cors });
        }

        // ── Step 1: Fetch YouTube market data ────────────────────────────────
        let videos: VideoData[] = [];
        let searchResults: SearchResult[] = [];

        if (youtubeKeys.length > 0) {
            const shuffledKeys = [...youtubeKeys].sort(() => Math.random() - 0.5);
            for (const activeKey of shuffledKeys) {
                try {
                    const ytData = await searchYouTubeForTopic(activeKey, `${topic} ${category}`, 25);
                    videos = ytData.videos;
                    searchResults = ytData.searchResults;
                    if (videos.length > 0) break; // Success
                } catch (err) {
                    if (err instanceof Error && err.message === "QUOTA_EXCEEDED") {
                        logger.warn("[Channel Creation] YouTube Quota Exceeded for a key, trying next...");
                        continue;
                    }
                    logger.warn("[Channel Creation] YouTube API error for a key, rotating:", err);
                }
            }
        }

        // Final fallback log if all keys failed
        if (youtubeKeys.length > 0 && videos.length === 0) {
            logger.error("[Channel Creation] ALL YouTube API keys failed or exhausted. Proceeding with AI-only mode.");
        }

        // ── Step 2: Compute market intelligence ──────────────────────────────
        const market = computeMarketIntelligence(topic, videos, searchResults);

        // ── Step 3: Generate optimal tags ────────────────────────────────────
        const suggestedTags = generateOptimalTags(topic, videos, market.trendingKeywords);

        // ── Step 4: Build AI prompt with real market data ────────────────────
        const topVideoSummary = videos
            .sort((a, b) => b.views - a.views)
            .slice(0, 10)
            .map((v, i) => `  ${i + 1}. "${v.title}" by ${v.channel} — ${v.views.toLocaleString()} views`)
            .join("\n");

        const competitorChannels = [...new Set(videos.map(v => v.channel))].slice(0, 8).join(", ");

        const prompt = `You are an elite YouTube channel creation strategist with deep market knowledge.

TASK: Analyze the "${topic}" niche in the "${category}" category and generate a comprehensive channel blueprint.

REAL YOUTUBE MARKET DATA (from YouTube API — treat as ground truth):
- Videos analyzed: ${videos.length}
- Demand Score: ${market.demandScore}/100
- Competition: ${market.difficultyRating} (${market.topCompetitorChannels} competing channels)
- Growth Trajectory: ${market.growthTrajectory}
- Avg Competitor Views: ${market.avgCompetitorViews.toLocaleString()}
- Avg Competitor Subscribers: ${market.avgCompetitorSubs.toLocaleString()}
- Trending Keywords: ${market.trendingKeywords.join(", ") || "none detected"}
- Content Gaps Found: ${market.contentGapCount}
- Upload Frequency Benchmark: ${market.uploadFrequencyBenchmark} videos/week
- Market Verdict: ${market.overallVerdict}

TOP PERFORMING VIDEOS IN THIS NICHE:
${topVideoSummary || "  No video data available"}

ACTIVE COMPETITOR CHANNELS:
${competitorChannels || "No competitor data available"}

AUDIENCE PAIN POINTS DETECTED:
${market.audiencePainPoints.length > 0 ? market.audiencePainPoints.join(", ") : "No specific pain points detected from comments"}

YOUR TASK — Generate ALL of the following:

1. CHANNEL NAMES: Suggest exactly 5 unique, modern, memorable YouTube channel names for a "${topic}" channel.
   Rules:
   - Names must be ORIGINAL and NOT already used by existing popular YouTube channels
   - Names should be 1-3 words, catchy, and brandable
   - Avoid generic patterns like "[Topic] TV", "[Topic] Hub", "[Topic] Channel"
   - Think modern startup-style naming: invented words, clever wordplay, abstract concepts
   - Each name should have a different vibe (tech, playful, authoritative, minimalist, bold)
   - Include a brief reasoning for each name

2. VIDEO IDEAS: Generate exactly 5 high-potential video ideas that:
   - Are specifically aligned to the "${topic}" niche (NOT generic YouTube advice)
   - Address the actual market gaps and audience pain points found above
   - Have specific, clickable titles (not templates)
   - Include a compelling hook (first 10 seconds of the video)
   - Include recommended format (tutorial, deep dive, comparison, etc.)
   - Are ordered by estimated view potential (highest first)

3. SUB-NICHES: Identify 3 promising sub-niches within "${topic}" that have:
   - Lower competition than the main topic
   - Growing search demand
   - Clear audience need

4. CONTENT STRATEGY: A brief 3-sentence content strategy for the first month.

RESPOND WITH ONLY THIS JSON:
{
  "channelNames": [
    { "name": "string", "reasoning": "string", "vibe": "string" }
  ],
  "videoIdeas": [
    {
      "title": "string",
      "hook": "string",
      "format": "string",
      "whyItWorks": "string",
      "estimatedViewPotential": "high|medium|low",
      "targetAudience": "string"
    }
  ],
  "subNiches": [
    { "name": "string", "opportunity": "string", "competition": "Low|Medium|High" }
  ],
  "contentStrategy": "string",
  "channelDescription": "string"
}`;

        const keys = [
            process.env.GROQ_API_KEY,
            process.env.GROQ_API_KEY_2,
            process.env.GROQ_API_KEY_3
        ].filter(Boolean) as string[];

        if (keys.length === 0) {
            return NextResponse.json({ error: "Groq API keys not configured" }, { status: 503 });
        }

        let rawText: string = "";
        let success = false;
        let lastError: any = null;

        const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

        for (const activeKey of shuffledKeys) {
            try {
                const groq = createGroq({ apiKey: activeKey });
                const result = await generateText({
                    model: groq("llama-3.3-70b-versatile"),
                    messages: [
                        {
                            role: "system",
                            content: "You are a JSON API. Respond ONLY with valid JSON matching the exact schema provided. No markdown fences, no explanation text.",
                        },
                        { role: "user", content: prompt },
                    ],
                    maxOutputTokens: 3000,
                    temperature: 0.7,
                });
                rawText = result.text;
                success = true;
                break; // If successful, exit the retry loop
            } catch (aiErr: any) {
                lastError = aiErr;
                logger.warn("[Key Rotation] Key failed or rate-limited, trying next...");
            }
        }

        if (!success) {
            return NextResponse.json({ error: "AI temporarily unavailable. Please try again." }, { status: 503, headers: cors });
        }

        // ── Step 5: Parse AI response ────────────────────────────────────────
        let aiOutput: {
            channelNames: Array<{ name: string; reasoning: string; vibe: string }>;
            videoIdeas: Array<{
                title: string;
                hook: string;
                format: string;
                whyItWorks: string;
                estimatedViewPotential: string;
                targetAudience: string;
            }>;
            subNiches: Array<{ name: string; opportunity: string; competition: string }>;
            contentStrategy: string;
            channelDescription: string;
        };

        try {
            const start = rawText.indexOf("{");
            const end = rawText.lastIndexOf("}");
            if (start === -1 || end <= start) throw new Error("No JSON found");
            aiOutput = JSON.parse(rawText.slice(start, end + 1));
        } catch {
            return NextResponse.json({ error: "AI response format error. Please retry." }, { status: 502, headers: cors });
        }

        // ── Step 6: Assemble response ────────────────────────────────────────
        return NextResponse.json({
            success: true,
            topic,
            category,
            channelNames: aiOutput.channelNames ?? [],
            channelDescription: aiOutput.channelDescription ?? "",
            videoIdeas: aiOutput.videoIdeas ?? [],
            subNiches: aiOutput.subNiches ?? [],
            contentStrategy: aiOutput.contentStrategy ?? "",
            suggestedTags,
            marketAnalysis: {
                demandScore: market.demandScore,
                saturationLevel: market.saturationLevel,
                growthTrajectory: market.growthTrajectory,
                difficultyRating: market.difficultyRating,
                topCompetitorChannels: market.topCompetitorChannels,
                avgCompetitorViews: market.avgCompetitorViews,
                avgCompetitorSubs: market.avgCompetitorSubs,
                contentGapCount: market.contentGapCount,
                uploadFrequencyBenchmark: market.uploadFrequencyBenchmark,
                trendingKeywords: market.trendingKeywords,
                bestSubNiches: market.bestSubNiches,
                overallVerdict: market.overallVerdict,
                outlierVideos: market.outlierVideos,
                optimalUploadSchedule: market.optimalUploadSchedule,
            },
            estimatedFirstYearViews: market.estimatedFirstYearViews,
            revenueEstimate: market.revenueEstimate,
            velocityInsight: market.velocityInsight,
            saturationInsight: market.saturationInsight,
            trendInsight: market.trendInsight,
            competitionInsight: market.competitionInsight,
        });

    } catch (err) {
        logger.error("[CHANNEL_CREATION_ERROR]", err);
        return NextResponse.json({ error: "Failed to generate channel blueprint." }, { status: 500 });
    }
}
