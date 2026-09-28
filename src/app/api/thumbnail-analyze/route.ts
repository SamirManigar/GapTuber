import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserByEmail, getChannelById, deductUserCredits } from "@/db/queries";
import { getRandomYouTubeApiKey } from "@/lib/youtube-server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { logger } from "@/lib/logger";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
    keyword: z.string().min(1).max(200).trim(),
    channelId: z.string().uuid(),
});

const YT_BASE = "https://www.googleapis.com/youtube/v3";

interface ThumbnailResult {
    videoId: string;
    title: string;
    channel: string;
    thumbnailUrl: string;
    views: number;
    likes: number;
}

/**
 * POST /api/thumbnail-analyze
 * Fetches top competitor thumbnails for a keyword and runs AI analysis.
 * Deducts 1 credit (Pro feature).
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const parsed = RequestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
        }

        const { keyword, channelId } = parsed.data;

        const dbUser = await getUserByEmail(session.user.email);
        if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
        if (dbUser.credits < 1) return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });

        const channel = await getChannelById(channelId);
        if (!channel || channel.userId !== dbUser.id) {
            return NextResponse.json({ error: "Channel not found" }, { status: 404 });
        }

        // Rate limit
        const rl = await rateLimit(`thumbnail-analyze:${dbUser.email}`, 10, 3600 * 1000);
        if (!rl.allowed) {
            return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
        }

        const apiKey = getRandomYouTubeApiKey();
        if (!apiKey) return NextResponse.json({ error: "YouTube API key missing." }, { status: 500 });

        // 1. Search YouTube for top 6 videos for this keyword
        const searchUrl = `${YT_BASE}/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=6&order=viewCount&key=${apiKey}`;
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) {
            return NextResponse.json({ error: "Failed to fetch YouTube search results." }, { status: 502 });
        }

        const searchData = await searchRes.json() as {
            items?: Array<{
                id: { videoId: string };
                snippet: {
                    title: string;
                    channelTitle: string;
                    thumbnails: {
                        maxres?: { url: string };
                        high?: { url: string };
                        medium?: { url: string };
                    };
                };
            }>;
        };

        const videoIds = (searchData.items ?? []).map(i => i.id.videoId).filter(Boolean);
        if (videoIds.length === 0) {
            return NextResponse.json({ error: "No videos found for this keyword." }, { status: 404 });
        }

        // 2. Get stats for these videos
        const statsUrl = `${YT_BASE}/videos?part=statistics,snippet&id=${videoIds.join(",")}&key=${apiKey}`;
        const statsRes = await fetch(statsUrl);
        const statsData = await statsRes.json() as {
            items?: Array<{
                id: string;
                snippet: { title: string; channelTitle: string };
                statistics: { viewCount?: string; likeCount?: string };
            }>;
        };

        // 3. Build structured thumbnail results
        const thumbnails: ThumbnailResult[] = (searchData.items ?? []).map(item => {
            const stats = (statsData.items ?? []).find(s => s.id === item.id.videoId);
            return {
                videoId: item.id.videoId,
                title: item.snippet.title,
                channel: item.snippet.channelTitle,
                thumbnailUrl: item.snippet.thumbnails.maxres?.url
                    ?? item.snippet.thumbnails.high?.url
                    ?? item.snippet.thumbnails.medium?.url
                    ?? `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`,
                views: parseInt(stats?.statistics.viewCount ?? "0"),
                likes: parseInt(stats?.statistics.likeCount ?? "0"),
            };
        });

        // 4. AI analysis of thumbnail patterns
        const thumbnailList = thumbnails.map((t, i) =>
            `${i + 1}. "${t.title}" by ${t.channel} — ${t.views.toLocaleString()} views\n   Thumbnail: ${t.thumbnailUrl}`
        ).join("\n\n");

        const keys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3].filter(Boolean) as string[];
        if (keys.length === 0) return NextResponse.json({ error: "AI not configured." }, { status: 503 });

        const prompt = `You are a YouTube thumbnail strategy expert. Analyze the following top-performing thumbnails for the keyword: "${keyword}".

TOP COMPETITOR THUMBNAILS:
${thumbnailList}

Based on these thumbnails, provide:
1. PATTERNS: What visual/text patterns appear in successful thumbnails for this topic?
2. GAPS: What thumbnail approaches are NOT being used that could stand out?
3. MY_RECOMMENDATION: A specific, actionable description of what the creator's thumbnail should look like to differentiate from competitors.
4. TEXT_TIPS: 2-3 specific text overlay recommendations.
5. COLOR_PALETTE: Suggested dominant colors to stand out.

Respond in JSON matching exactly: {"patterns": ["..."], "gaps": ["..."], "myRecommendation": "...", "textTips": ["..."], "colorPalette": ["..."]}`;

        let analysis: Record<string, unknown> | null = null;
        const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

        for (const key of shuffledKeys) {
            try {
                const groq = createGroq({ apiKey: key });
                const result = await generateText({
                    model: groq("openai/gpt-oss-120b"),
                    messages: [
                        { role: "system", content: "You are a JSON API. Respond with only valid JSON, no markdown fences." },
                        { role: "user", content: prompt },
                    ],
                    temperature: 0.3,
                    maxOutputTokens: 800,
                });

                let raw = result.text.trim();
                const start = raw.indexOf("{");
                const end = raw.lastIndexOf("}");
                if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);

                analysis = JSON.parse(raw);
                break;
            } catch (e) {
                logger.warn("[ThumbnailAnalyze] AI key failed:", (e as Error)?.message);
            }
        }

        if (!analysis) {
            return NextResponse.json({ error: "AI analysis failed." }, { status: 503 });
        }

        // 5. Deduct credits
        await deductUserCredits(dbUser.id, 1, "Thumbnail Intelligence Analysis");

        return NextResponse.json({
            success: true,
            keyword,
            thumbnails,
            analysis,
        });

    } catch (err) {
        logger.error("[ThumbnailAnalyze Error]", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
