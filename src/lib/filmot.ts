/**
 * Filmot Caption Search Integration
 * Searches YouTube video captions/transcripts for keyword mentions.
 * This surfaces topics that are *spoken* about inside videos but not titled —
 * a unique gap signal no other public tool currently provides.
 *
 * API docs: https://filmot.com/api
 * Free tier: limited requests/day; key required.
 */

import { cacheData } from "@/lib/cache";
import { logger } from "@/lib/logger";

const FILMOT_BASE = "https://filmot.com/api/getvideos";

export interface FilmotResult {
    videoId: string;
    title: string;
    channel: string;
    captionSnippet: string;
    views: number;
    publishedAt: string;
}

/**
 * Searches Filmot for videos where the keyword appears inside captions.
 * Returns [] gracefully when FILMOT_API_KEY is not configured or on any error.
 */
export async function searchCaptionGaps(keyword: string): Promise<FilmotResult[]> {
    const apiKey = process.env.FILMOT_API_KEY;
    if (!apiKey) {
        // Silently skip — Filmot is optional enrichment
        return [];
    }

    const cacheKey = `filmot:caption:${keyword.toLowerCase().trim()}`;
    return cacheData(cacheKey, async () => {
        try {
            const url = new URL(FILMOT_BASE);
            url.searchParams.set("key", apiKey);
            url.searchParams.set("query", keyword);
            url.searchParams.set("grid", "1");
            url.searchParams.set("order", "2");  // sort by view count
            url.searchParams.set("countryCode", "");

            const res = await fetch(url.toString(), {
                signal: AbortSignal.timeout(8000),
                headers: { "User-Agent": "GapTuber/2.0 (market-intelligence-tool)" },
            });

            if (!res.ok) {
                logger.warn(`[Filmot] Non-OK response: ${res.status}`);
                return [];
            }

            // Filmot returns an array of video objects
            const data = await res.json() as Array<{
                videoId?: string;
                id?: string;
                title?: string;
                channelTitle?: string;
                channelName?: string;
                snippet?: string;
                transcriptSnippet?: string;
                viewCount?: number | string;
                publishedAt?: string;
            }>;

            if (!Array.isArray(data)) return [];

            const results: FilmotResult[] = data.slice(0, 8).map(item => ({
                videoId: item.videoId ?? item.id ?? "",
                title: item.title ?? "Untitled",
                channel: item.channelTitle ?? item.channelName ?? "Unknown",
                captionSnippet: (item.snippet ?? item.transcriptSnippet ?? "").slice(0, 200),
                views: typeof item.viewCount === "string"
                    ? parseInt(item.viewCount, 10) || 0
                    : item.viewCount ?? 0,
                publishedAt: item.publishedAt ?? "",
            })).filter(r => r.videoId);

            logger.info(`[Filmot] Found ${results.length} caption results for "${keyword}".`);
            return results;
        } catch (err) {
            logger.warn(`[Filmot] Request failed: ${(err as Error)?.message}`);
            return [];
        }
    }, 3600); // 1 hour cache
}

/**
 * Formats Filmot results as a concise context string for the LLM prompt.
 */
export function buildFilmotContext(results: FilmotResult[], keyword: string): string {
    if (results.length === 0) return "";
    const lines = results.slice(0, 5).map((r, i) =>
        `  ${i + 1}. "${r.title}" by ${r.channel} (${r.views.toLocaleString()} views) — caption: "...${r.captionSnippet}..."`
    );
    return `\nCAPTION SIGNAL (from Filmot transcript search — keyword "${keyword}" found spoken inside these videos but NOT necessarily in their titles):\n${lines.join("\n")}\nNote: caption matches indicate topics viewers hear about but that lack dedicated title coverage — a potential untitled gap.`;
}
