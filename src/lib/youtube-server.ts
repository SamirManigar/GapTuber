import { VideoData, SearchResult, CommentData } from "./engine/scoring";
import { cacheData } from "./cache";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

type SearchItem = { id: { videoId?: string; channelId?: string } };
type VideoItem = {
    id: string;
    snippet: { title: string; publishedAt: string; channelTitle: string; channelId: string; tags?: string[]; description?: string };
    statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
    contentDetails?: { duration?: string };
};
type ChannelItem = {
    id: string;
    snippet?: { title?: string; customUrl?: string; description?: string; thumbnails?: { default?: { url?: string } } };
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
};
type CommentThreadItem = {
    id: string;
    snippet: {
        topLevelComment: {
            id: string;
            snippet: { textOriginal?: string; textDisplay: string; likeCount?: number | string; authorDisplayName?: string };
        };
    };
};

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
            // Resolve an @handle exactly. The previous search-based lookup could
            // silently select a similarly named channel and analyze the wrong data.
            if (handleMatch) {
                const exactUrl = `${YT_BASE}/channels?part=id&forHandle=%40${encodeURIComponent(handle)}&key=${apiKey}`;
                const exactRes = await fetch(exactUrl);
                if (!exactRes.ok) throw new Error(`YouTube channel lookup failed (${exactRes.status})`);
                const exactData = await exactRes.json();
                return exactData.items?.[0]?.id ?? null;
            }

            // Legacy usernames/custom names do not have an exact modern-handle
            // endpoint, so retain search only as a clearly limited fallback.
            const searchUrl = `${YT_BASE}/search?part=snippet&q=${encodeURIComponent(handle)}&type=channel&maxResults=1&key=${apiKey}`;
            const res = await fetch(searchUrl);
            if (!res.ok) throw new Error(`YouTube channel search failed (${res.status})`);
            
            const data = await res.json();
            if (data.items && data.items.length > 0) {
                return data.items[0].id.channelId;
            }
        } catch (e) {
            console.error("Error resolving channel ID:", e);
            throw e;
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
            // Reading the channel uploads playlist is exact and costs far less API
            // quota than a fuzzy search.list request.
            const channelRes = await fetch(`${YT_BASE}/channels?part=contentDetails&id=${channelId}&key=${apiKey}`);
            if (!channelRes.ok) throw new Error(`YouTube channel details failed (${channelRes.status})`);
            const channelData = await channelRes.json() as { items?: ChannelItem[] };
            const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
            if (!uploadsPlaylistId) return [];

            const playlistRes = await fetch(`${YT_BASE}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${apiKey}`);
            if (!playlistRes.ok) throw new Error(`YouTube uploads playlist failed (${playlistRes.status})`);
            const playlistData = await playlistRes.json() as { items?: Array<{ contentDetails?: { videoId?: string } }> };
            const videoIds = (playlistData.items ?? []).flatMap(item => item.contentDetails?.videoId ? [item.contentDetails.videoId] : []);

            if (videoIds.length === 0) return [];

            const statsUrl = `${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${apiKey}`;
            const statsRes = await fetch(statsUrl);
            if (!statsRes.ok) return [];

            const statsData = await statsRes.json() as { items?: VideoItem[] };
            return (statsData.items ?? []).map(item => ({
                title: item.snippet.title,
                views: parseInt(item.statistics.viewCount || "0"),
                likes: parseInt(item.statistics.likeCount || "0"),
                comments: parseInt(item.statistics.commentCount || "0"),
                uploadDate: item.snippet.publishedAt,
                url: `https://www.youtube.com/watch?v=${item.id}`,
                channel: item.snippet.channelTitle,
                subscriberCount: undefined, // populated below
                duration: item.contentDetails?.duration,
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
export async function getSearchResults(
    keyword: string,
    apiKey: string,
    maxResults = 15,
    publishedAfter?: Date,
    order: "relevance" | "date" = "relevance"
): Promise<SearchResult[]> {
    const freshnessKey = publishedAfter?.toISOString().slice(0, 10) ?? "all-time";
    const cacheKey = `yt:v3:search:${keyword}:${maxResults}:${freshnessKey}:${order}`;
    return cacheData(cacheKey, async () => {
        try {
            const searchParams = new URLSearchParams({
                part: "snippet",
                q: keyword,
                type: "video",
                order: order,
                maxResults: String(maxResults),
                key: apiKey,
            });
            if (publishedAfter) searchParams.set("publishedAfter", publishedAfter.toISOString());

            const searchRes = await fetch(`${YT_BASE}/search?${searchParams.toString()}`);
            if (!searchRes.ok) throw new Error(`YouTube search failed (${searchRes.status})`);

            const searchData = await searchRes.json() as { items?: SearchItem[] };
            const videoIds = (searchData.items ?? []).flatMap(item => item.id.videoId ? [item.id.videoId] : []);

            if (videoIds.length === 0) return [];

            const statsUrl = `${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${apiKey}`;
            const statsRes = await fetch(statsUrl);
            if (!statsRes.ok) throw new Error(`YouTube video statistics failed (${statsRes.status})`);

            const statsData = await statsRes.json() as { items?: VideoItem[] };

            // Tier 1A: fetch subscriber counts for the channels in one batch call
            const channelIds = [...new Set((statsData.items ?? []).map(item => item.snippet.channelId))].join(",");
            const subMap: Record<string, number> = {};
            let hiddenSubMap: Record<string, boolean> = {};
            if (channelIds) {
                try {
                    const chanRes = await fetch(`${YT_BASE}/channels?part=statistics&id=${channelIds}&key=${apiKey}`);
                    if (chanRes.ok) {
                        const chanData = await chanRes.json() as { items?: ChannelItem[] };
                        for (const c of (chanData.items ?? [])) {
                            subMap[c.id] = parseInt(c.statistics?.subscriberCount || "0");
                            if ((c.statistics as any)?.hiddenSubscriberCount) {
                                hiddenSubMap[c.id] = true;
                            }
                        }
                    }
                } catch { /* non-critical */ }
            }

            return (statsData.items ?? []).map(item => ({
                title: item.snippet.title,
                channel: item.snippet.channelTitle,
                channelId: item.snippet.channelId,
                views: parseInt(item.statistics.viewCount || "0"),
                likes: parseInt(item.statistics.likeCount || "0"),
                uploadDate: item.snippet.publishedAt,
                subscriberCount: subMap[item.snippet.channelId] ?? 0,
                hiddenSubscriberCount: hiddenSubMap[item.snippet.channelId] ?? false,
                duration: item.contentDetails?.duration,
            }));
        } catch (e) {
            console.error("Error fetching search results:", e);
            throw e;
        }
    }, 3600); // Cache for 1 hour
}

/**
 * Fetch top comments for a specific video ID.
 */
export async function getTopComments(videoId: string, apiKey: string, maxResults = 20): Promise<CommentData[]> {
    const cacheKey = `yt:v2:comments:${videoId}:${maxResults}`;
    return cacheData(cacheKey, async () => {
        try {
            const url = `${YT_BASE}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&order=relevance&key=${apiKey}`;
            const res = await fetch(url);
            if (!res.ok) return [];
            
            const data = await res.json() as { items?: CommentThreadItem[] };
            return (data.items ?? []).map(item => {
                const comment = item.snippet.topLevelComment.snippet;
                return {
                    id: item.snippet.topLevelComment.id ?? item.id,
                    text: (comment.textOriginal ?? comment.textDisplay.replace(/<[^>]+>/g, '')).slice(0, 500),
                    likeCount: parseInt(String(comment.likeCount || "0")),
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

            const searchData = await searchRes.json() as { items?: SearchItem[] };
            const channelIds = (searchData.items ?? []).flatMap(item => item.id.channelId ? [item.id.channelId] : []);

            if (channelIds.length === 0) return [];

            // 2. Get detailed stats for these channels
            const statsUrl = `${YT_BASE}/channels?part=snippet,statistics&id=${channelIds.join(",")}&key=${apiKey}`;
            const statsRes = await fetch(statsUrl);
            if (!statsRes.ok) return [];

            const statsData = await statsRes.json() as { items?: ChannelItem[] };
            
            // 3. Format and sort by subscriber count
            const competitors = (statsData.items ?? []).map(item => ({
                channelId: item.id,
                name: item.snippet?.title ?? "Unknown channel",
                handle: item.snippet?.customUrl || item.snippet?.title || item.id,
                thumbnail: item.snippet?.thumbnails?.default?.url || "",
                subscribers: parseInt(item.statistics?.subscriberCount || "0"),
                totalViews: parseInt(item.statistics?.viewCount || "0"),
                videoCount: parseInt(item.statistics?.videoCount || "0"),
                description: item.snippet?.description?.slice(0, 100) ?? "",
            })).sort((a, b) => b.subscribers - a.subscribers).slice(0, maxResults);

            return competitors;
        } catch (e) {
            console.error("Error fetching competitors:", e);
            return [];
        }
    }, 86400); // Cache for 24 hours
}

/**
 * Fetch detailed statistics for specific video IDs.
 */
export async function getVideoStats(videoIds: string[], apiKey: string) {
    if (videoIds.length === 0) return [];
    
    // Split into chunks of 50 (YouTube API limit)
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += 50) {
        chunks.push(videoIds.slice(i, i + 50));
    }
    
    const allVideos = [];
    for (const chunk of chunks) {
        try {
            const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${chunk.join(",")}&key=${apiKey}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            
            const data = await res.json() as any;
            allVideos.push(...(data.items ?? []));
        } catch (e) {
            console.error("Error fetching video stats chunk:", e);
        }
    }
    
    return allVideos;
}
