import { VideoData, SearchResult } from "./engine/scoring";
import { cacheData } from "./cache";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Returns a random YouTube API key from the environment pool to distribute quota load.
 */
export function getRandomYouTubeApiKey(): string {
    const rawKeys = [
        process.env.YOUTUBE_API_KEY,
        process.env.YOUTUBE_API_KEY_2,
        process.env.YOUTUBE_API_KEY_3
    ].filter(Boolean) as string[];

    // Support comma-separated lists in a single env variable
    const keys = rawKeys.flatMap(k => k.split(",").map(s => s.trim())).filter(Boolean);

    if (keys.length === 0) {
        throw new Error("No YOUTUBE_API_KEY found in environment variables.");
    }

    return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * Resolves a channel URL or handle (e.g. "https://www.youtube.com/@mrbeast" or "@mrbeast") to a YouTube Channel ID.
 */
export async function getChannelIdFromHandle(handleOrUrl: string, apiKey: string): Promise<string | null> {
    const handleMatch = handleOrUrl.match(/@([a-zA-Z0-9_-]+)/);
    const handle = handleMatch ? handleMatch[1] : handleOrUrl.replace("https://www.youtube.com/channel/", "");
    
    if (handleOrUrl.includes("/channel/")) {
        return handle; // Already a channel ID
    }

    const cacheKey = `yt:v2:channelId:${handle}`;
    return cacheData(cacheKey, async () => {
        try {
            const searchUrl = `${YT_BASE}/search?part=snippet&q=${encodeURIComponent(handle)}&type=channel&maxResults=1&key=${apiKey}`;
            const res = await fetch(searchUrl);
            if (!res.ok) return null;
            
            const data = await res.json();
            if (data.items && data.items.length > 0) {
                return data.items[0].id.channelId;
            }
        } catch (e) {
            console.error("Error resolving channel ID:", e);
        }
        return null;
    }, 86400); // Cache for 24 hours
}

/**
 * Fetches recent videos for a specific channel.
 */
export async function getRecentChannelVideos(channelId: string, apiKey: string, maxResults = 10): Promise<VideoData[]> {
    const cacheKey = `yt:v2:recentVideos:${channelId}:${maxResults}`;
    return cacheData(cacheKey, async () => {
        try {
            const searchUrl = `${YT_BASE}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${apiKey}`;
            const searchRes = await fetch(searchUrl);
            if (!searchRes.ok) return [];

            const searchData = await searchRes.json();
            const videoIds = (searchData.items || []).map((item: any) => item.id.videoId).filter(Boolean);

            if (videoIds.length === 0) return [];

            const statsUrl = `${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${apiKey}`;
            const statsRes = await fetch(statsUrl);
            if (!statsRes.ok) return [];

            const statsData = await statsRes.json();
            return (statsData.items || []).map((item: any) => ({
                title: item.snippet.title,
                views: parseInt(item.statistics.viewCount || "0"),
                likes: parseInt(item.statistics.likeCount || "0"),
                comments: parseInt(item.statistics.commentCount || "0"),
                uploadDate: item.snippet.publishedAt,
                url: `https://www.youtube.com/watch?v=${item.id}`,
                channel: item.snippet.channelTitle,
                subscriberCount: undefined, // populated below
                duration: item.contentDetails.duration,
                tags: item.snippet.tags,
                description: item.snippet.description?.slice(0, 200),
            })) as VideoData[];
        } catch (e) {
            console.error("Error fetching channel videos:", e);
            return [];
        }
    }, 3600); // Cache for 1 hour
}

/**
 * Fetches search results for a keyword to determine market saturation.
 */
export async function getSearchResults(keyword: string, apiKey: string, maxResults = 15): Promise<SearchResult[]> {
    const cacheKey = `yt:v2:search:${keyword}:${maxResults}`;
    return cacheData(cacheKey, async () => {
        try {
            const searchUrl = `${YT_BASE}/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&order=relevance&maxResults=${maxResults}&key=${apiKey}`;
            const searchRes = await fetch(searchUrl);
            if (!searchRes.ok) return [];

            const searchData = await searchRes.json();
            const videoIds = (searchData.items || []).map((item: any) => item.id.videoId).filter(Boolean);

            if (videoIds.length === 0) return [];

            const statsUrl = `${YT_BASE}/videos?part=snippet,statistics&id=${videoIds.join(",")}&key=${apiKey}`;
            const statsRes = await fetch(statsUrl);
            if (!statsRes.ok) return [];

            const statsData = await statsRes.json();

            // Tier 1A: fetch subscriber counts for the channels in one batch call
            const channelIds = [...new Set((statsData.items || []).map((item: any) => item.snippet.channelId))].join(",");
            let subMap: Record<string, number> = {};
            if (channelIds) {
                try {
                    const chanRes = await fetch(`${YT_BASE}/channels?part=statistics&id=${channelIds}&key=${apiKey}`);
                    if (chanRes.ok) {
                        const chanData = await chanRes.json();
                        for (const c of (chanData.items || [])) {
                            subMap[c.id] = parseInt(c.statistics?.subscriberCount || "0");
                        }
                    }
                } catch { /* non-critical */ }
            }

            return (statsData.items || []).map((item: any) => ({
                title: item.snippet.title,
                channel: item.snippet.channelTitle,
                views: parseInt(item.statistics.viewCount || "0"),
                likes: parseInt(item.statistics.likeCount || "0"),
                uploadDate: item.snippet.publishedAt,
                subscriberCount: subMap[item.snippet.channelId] ?? 0,
            }));
        } catch (e) {
            console.error("Error fetching search results:", e);
            return [];
        }
    }, 3600); // Cache for 1 hour
}

/**
 * Fetch top comments for a specific video ID.
 */
export async function getTopComments(videoId: string, apiKey: string, maxResults = 20) {
    const cacheKey = `yt:v2:comments:${videoId}:${maxResults}`;
    return cacheData(cacheKey, async () => {
        try {
            const url = `${YT_BASE}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&order=relevance&key=${apiKey}`;
            const res = await fetch(url);
            if (!res.ok) return [];
            
            const data = await res.json();
            return (data.items || []).map((item: any) => {
                const comment = item.snippet.topLevelComment.snippet;
                return {
                    text: comment.textDisplay.replace(/<[^>]+>/g, '').slice(0, 500),
                    likeCount: parseInt(comment.likeCount || "0"),
                    authorName: comment.authorDisplayName,
                };
            });
        } catch (e) {
            console.error("Error fetching comments:", e);
            return [];
        }
    }, 3600); // Cache for 1 hour
}

/**
 * Fetch top competitor channels based on a topic/niche.
 */
export async function getTopCompetitorsForTopic(topic: string, apiKey: string, maxResults = 5) {
    const cacheKey = `yt:v2:competitors:${topic}:${maxResults}`;
    return cacheData(cacheKey, async () => {
        try {
            // 1. Search for channels matching the topic
            const searchUrl = `${YT_BASE}/search?part=snippet&q=${encodeURIComponent(topic)}&type=channel&order=relevance&maxResults=${maxResults * 2}&key=${apiKey}`;
            const searchRes = await fetch(searchUrl);
            if (!searchRes.ok) return [];

            const searchData = await searchRes.json();
            const channelIds = (searchData.items || []).map((item: any) => item.id.channelId).filter(Boolean);

            if (channelIds.length === 0) return [];

            // 2. Get detailed stats for these channels
            const statsUrl = `${YT_BASE}/channels?part=snippet,statistics&id=${channelIds.join(",")}&key=${apiKey}`;
            const statsRes = await fetch(statsUrl);
            if (!statsRes.ok) return [];

            const statsData = await statsRes.json();
            
            // 3. Format and sort by subscriber count
            const competitors = (statsData.items || []).map((item: any) => ({
                channelId: item.id,
                name: item.snippet.title,
                handle: item.snippet.customUrl || item.snippet.title,
                thumbnail: item.snippet.thumbnails?.default?.url || "",
                subscribers: parseInt(item.statistics.subscriberCount || "0"),
                totalViews: parseInt(item.statistics.viewCount || "0"),
                videoCount: parseInt(item.statistics.videoCount || "0"),
                description: item.snippet.description?.slice(0, 100),
            })).sort((a: any, b: any) => b.subscribers - a.subscribers).slice(0, maxResults);

            return competitors;
        } catch (e) {
            console.error("Error fetching competitors:", e);
            return [];
        }
    }, 86400); // Cache for 24 hours
}
