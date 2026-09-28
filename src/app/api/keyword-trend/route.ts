import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { computeTrendMomentum, type VideoData } from "@/lib/engine/scoring";
import { getCorsHeaders, optionsResponse } from "@/lib/cors";
import { resolveUserFromRequest } from "@/lib/resolve-user";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getRandomYouTubeApiKey, getSearchResults } from "@/lib/youtube-server";

export const runtime = "nodejs";

const RequestSchema = z.object({ keyword: z.string().trim().min(1).max(100) });

export async function OPTIONS(req: NextRequest) {
    return optionsResponse(req);
}

export async function POST(req: NextRequest) {
    const cors = getCorsHeaders(req);
    const user = await resolveUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: cors });

    const limit = await rateLimit(`keyword-trend:${user.id}`, RATE_LIMITS.keywordTrend.max, RATE_LIMITS.keywordTrend.windowMs);
    if (!limit.allowed) return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429, headers: cors });

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400, headers: cors }); }
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400, headers: cors });

    const apiKey = getRandomYouTubeApiKey();
    if (!apiKey) return NextResponse.json({ success: false, error: "YouTube API unavailable" }, { status: 503, headers: cors });

    try {
        const results = await getSearchResults(parsed.data.keyword, apiKey, 20, new Date(Date.now() - 90 * 86_400_000), "date");
        const videos: VideoData[] = results.map(result => ({
            title: result.title,
            views: result.views,
            likes: result.likes,
            comments: 0,
            uploadDate: result.uploadDate,
            url: result.videoId ? `https://www.youtube.com/watch?v=${result.videoId}` : "",
            channel: result.channel,
            subscriberCount: result.subscriberCount,
        }));
        const trend = computeTrendMomentum(videos);
        return NextResponse.json({
            success: true,
            keyword: parsed.data.keyword,
            velocity: Math.round(trend.score * 10),
            trend: trend.trend,
            insight: trend.insight,
            sampleSize: videos.length,
            measuredAt: new Date().toISOString(),
        }, { headers: { ...cors, "Cache-Control": "private, max-age=300" } });
    } catch {
        return NextResponse.json({ success: false, error: "Could not fetch current YouTube evidence" }, { status: 502, headers: cors });
    }
}
