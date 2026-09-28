/**
 * Return YouTube Dislike API enrichment
 * Free, no API key required. Adds real dislike counts to VideoData objects.
 * https://returnyoutubedislike.com/docs
 *
 * Uses Promise.allSettled — never blocks a scan on failure.
 */

import type { VideoData } from "./scoring";
import { logger } from "@/lib/logger";

const RYD_BASE = "https://returnyoutubedislike.com/api/Votes";
// Cap how many videos we enrich per scan to avoid slow-downs on large batches
const ENRICH_LIMIT = 20;

interface RYDResponse {
    id: string;
    dateCreated: string;
    likes: number;
    dislikes: number;
    rating: number;
    viewCount: number;
    deleted: boolean;
}

/**
 * Extracts a video ID from a YouTube watch URL or bare ID string.
 */
function extractVideoId(url: string): string | null {
    // Already a bare ID (11 chars, no slashes)
    if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
    try {
        const u = new URL(url);
        return u.searchParams.get("v") ?? u.pathname.split("/").pop() ?? null;
    } catch {
        return null;
    }
}

/**
 * Fetches dislike counts for up to ENRICH_LIMIT videos and merges them back
 * into the VideoData array. Videos without dislike data are returned unchanged.
 */
export async function enrichWithDislikes(videos: VideoData[]): Promise<VideoData[]> {
    if (videos.length === 0) return videos;

    const toEnrich = videos.slice(0, ENRICH_LIMIT);
    const rest = videos.slice(ENRICH_LIMIT);

    const results = await Promise.allSettled(
        toEnrich.map(async (video): Promise<VideoData> => {
            const videoId = extractVideoId(video.url);
            if (!videoId) return video;

            const res = await fetch(`${RYD_BASE}?videoId=${videoId}`, {
                headers: { "User-Agent": "GapTuber/2.0 (market-intelligence-tool)" },
                // 5s timeout — never stall a scan
                signal: AbortSignal.timeout(5000),
            });

            if (!res.ok) return video;

            const data = await res.json() as RYDResponse;
            if (typeof data.dislikes !== "number") return video;

            return { ...video, dislikes: data.dislikes };
        })
    );

    let enrichedCount = 0;
    const enriched = results.map((result, i) => {
        if (result.status === "fulfilled") {
            if (result.value.dislikes !== undefined) enrichedCount++;
            return result.value;
        }
        // Silently fall back to original video on error
        logger.warn(`[RYD] Failed to fetch dislikes for video ${i}: ${(result.reason as Error)?.message}`);
        return toEnrich[i];
    });

    if (enrichedCount > 0) {
        logger.info(`[RYD] Enriched ${enrichedCount}/${toEnrich.length} videos with dislike data.`);
    }

    return [...enriched, ...rest];
}
