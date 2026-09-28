/**
 * Market Intelligence Engine
 * 
 * Fetches real YouTube search market data per keyword to replace heuristic scoring.
 * All functions use the existing YouTube Data API v3 key pool.
 */

import { cacheData } from "@/lib/cache";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeSearchItem {
    id?: { videoId?: string };
    snippet?: { channelId?: string };
}

interface YouTubeVideoItem {
    statistics?: { viewCount?: string };
    snippet?: { publishedAt?: string; channelId?: string; title?: string };
}

interface YouTubeChannelItem {
    id: string;
    statistics?: { subscriberCount?: string };
}

export interface MarketSearchData {
    keyword: string;
    /** Exact collection time; cached responses retain the original timestamp. */
    collectedAt: string;
    /** Average view count of the relevance sample; not direct search demand. */
    avgViews: number;
    /** Average subscriber count of channels ranking for this keyword */
    avgCompetitorSubscribers: number;
    /** % of the relevance sample uploaded in the last 90 days; a supply-freshness signal. */
    recentUploadRate: number;
    /** Total number of valid results found */
    resultCount: number;
    /** Top result titles (for AI context injection) */
    topTitles: string[];
    /** Highest view count among top results */
    maxViews: number;
    /** How many top results have < 100K subscribers on their channel */
    lowCompetitionCount: number;
}

/**
 * Fetches and computes real market signals for a keyword from YouTube Search.
 * Runs 3 API calls: search → videos stats → channel stats.
 */
export async function fetchMarketData(
    keyword: string,
    apiKey: string,
    maxResults = 10
): Promise<MarketSearchData | null> {
    const normalizedKeyword = keyword.trim().toLowerCase().replace(/\s+/g, " ");
    const cacheKey = `yt:v3:market:${normalizedKeyword}:${maxResults}`;

    return cacheData(cacheKey, async () => {
      try {
        // Step 1: Search YouTube for this keyword
        const searchUrl = `${YT_BASE}/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&order=relevance&maxResults=${maxResults}&key=${apiKey}`;
        const searchRes = await fetch(searchUrl, { cache: "no-store" });
        if (!searchRes.ok) return null;

        const searchData = await searchRes.json() as { items?: YouTubeSearchItem[] };
        const items = searchData.items ?? [];
        if (items.length === 0) return null;

        const videoIds = items.map(item => item.id?.videoId).filter((id): id is string => Boolean(id));
        const channelIds = [...new Set(items.map(item => item.snippet?.channelId).filter((id): id is string => Boolean(id)))];

        if (videoIds.length === 0) return null;

        // Step 2: Fetch video stats in parallel with channel stats
        const [videoRes, channelRes] = await Promise.all([
            fetch(`${YT_BASE}/videos?part=snippet,statistics&id=${videoIds.join(",")}&key=${apiKey}`, { cache: "no-store" }),
            channelIds.length > 0
                ? fetch(`${YT_BASE}/channels?part=statistics&id=${channelIds.join(",")}&key=${apiKey}`, { cache: "no-store" })
                : Promise.resolve(null),
        ]);

        if (!videoRes.ok) return null;

        const videoData = await videoRes.json() as { items?: YouTubeVideoItem[] };
        const videoItems = videoData.items ?? [];

        // Build subscriber map
        const subMap: Record<string, number> = {};
        if (channelRes && channelRes.ok) {
            const chanData = await channelRes.json() as { items?: YouTubeChannelItem[] };
            for (const c of (chanData.items ?? [])) {
                subMap[c.id] = parseInt(c.statistics?.subscriberCount ?? "0");
            }
        }

        // Step 3: Compute market signals
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        let totalViews = 0;
        let totalSubs = 0;
        let recentCount = 0;
        let maxViews = 0;
        let lowCompetitionCount = 0;
        const topTitles: string[] = [];

        for (const video of videoItems) {
            const views = parseInt(video.statistics?.viewCount ?? "0");
            const publishedAt = new Date(video.snippet?.publishedAt ?? "").getTime();
            const chanId = video.snippet?.channelId ?? "";
            const subs = subMap[chanId] ?? 0;

            totalViews += views;
            totalSubs += subs;
            if (!isNaN(publishedAt) && publishedAt > ninetyDaysAgo) recentCount++;
            if (views > maxViews) maxViews = views;
            if (subs < 100_000) lowCompetitionCount++;
            if (video.snippet?.title) topTitles.push(video.snippet.title);
        }

        const count = videoItems.length;
        if (count === 0) return null;

        return {
            keyword,
            collectedAt: new Date().toISOString(),
            avgViews: Math.round(totalViews / count),
            avgCompetitorSubscribers: Math.round(totalSubs / count),
            recentUploadRate: Math.round((recentCount / count) * 100),
            resultCount: count,
            topTitles: topTitles.slice(0, 8),
            maxViews,
            lowCompetitionCount,
        };
      } catch (e) {
        console.error(`[MarketIntel] Failed for "${keyword}":`, e);
        return null;
      }
    }, 3600);
}

/**
 * Compute real SEO score (0-100) from actual market search data.
 * 
 * - High avgViews in the relevance sample = stronger observed performance
 * - High avgCompetitorSubscribers = harder to rank = lower score
 * - High recentUploadRate = fresher current supply
 * - lowCompetitionCount = weak competition = bonus
 */
export function computeMarketSEOScore(market: MarketSearchData): number {
    let score = 30; // baseline

    // Observed-performance proxy: average views of the relevance sample.
    if (market.avgViews >= 500_000) score += 30;
    else if (market.avgViews >= 100_000) score += 22;
    else if (market.avgViews >= 50_000) score += 16;
    else if (market.avgViews >= 10_000) score += 10;
    else if (market.avgViews >= 1_000) score += 4;

    // Competition penalty: avg subscriber count of ranking channels
    if (market.avgCompetitorSubscribers > 5_000_000) score -= 25;
    else if (market.avgCompetitorSubscribers > 1_000_000) score -= 18;
    else if (market.avgCompetitorSubscribers > 500_000) score -= 12;
    else if (market.avgCompetitorSubscribers > 100_000) score -= 6;
    else if (market.avgCompetitorSubscribers > 10_000) score -= 2;

    // Fresh-supply adjustment: many recent videos in the relevance sample.
    if (market.recentUploadRate >= 70) score += 15;
    else if (market.recentUploadRate >= 40) score += 8;
    else if (market.recentUploadRate < 10) score -= 5; // stale topic

    // Weak competition bonus: many top results from small channels = opportunity
    if (market.lowCompetitionCount >= 7) score += 15;
    else if (market.lowCompetitionCount >= 5) score += 8;
    else if (market.lowCompetitionCount >= 3) score += 4;

    return Math.min(100, Math.max(5, score));
}

/**
 * Compute real uniqueness score (0-100) from market demand vs channel coverage.
 * 
 * A keyword is "unique opportunity" if the market has strong demand (high avgViews)
 * but the channel barely covers it.
 */
export function computeMarketUniquenessScore(
    market: MarketSearchData,
    channelCoverageFreqRatio: number // 0.0–1.0: how much channel already covers this topic
): number {
    // Base opportunity from market demand
    let demandScore = 0;
    if (market.avgViews >= 500_000) demandScore = 90;
    else if (market.avgViews >= 100_000) demandScore = 75;
    else if (market.avgViews >= 50_000) demandScore = 60;
    else if (market.avgViews >= 10_000) demandScore = 45;
    else if (market.avgViews >= 1_000) demandScore = 30;
    else demandScore = 15;

    // Gap multiplier: channel barely covering high-demand topic = maximum gap
    const coveragePenalty = channelCoverageFreqRatio * 60; // up to -60 for fully covered topics

    // Weak competition bonus: if you can actually rank here
    const competitionBonus = market.lowCompetitionCount >= 5 ? 15
        : market.lowCompetitionCount >= 3 ? 8 : 0;

    return Math.min(100, Math.max(5, Math.round(demandScore - coveragePenalty + competitionBonus)));
}

/**
 * Compute a current-sample momentum proxy (0-100) from recent-result share
 * and observed views. This is not direct search-volume history.
 */
export function computeMarketTrendVelocity(market: MarketSearchData): number {
    // Combine recent upload rate (supply side) with observed performance.
    const baseFromUploads = market.recentUploadRate; // 0-100
    const demandBonus = market.avgViews >= 100_000 ? 15
        : market.avgViews >= 50_000 ? 8 : 0;
    // Competition penalty: being "trending" matters less if you can't rank there
    const competitionPenalty = market.avgCompetitorSubscribers > 1_000_000 ? 15
        : market.avgCompetitorSubscribers > 100_000 ? 8 : 0;

    return Math.min(100, Math.max(0, Math.round(baseFromUploads + demandBonus - competitionPenalty)));
}
