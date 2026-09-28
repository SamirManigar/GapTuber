/**
 * YouTube Data API v3 Client
 * Fetches full channel video history (1000+ videos) using official API
 * No DOM scraping — structured, reliable, paginated data
 */

import { cacheData } from "../cache";
import { env } from "@/env";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YouTubeVideo {
    videoId: string;
    title: string;
    views: number;
    likes: number;
    comments: number;
    uploadDate: string; // ISO 8601
    duration: string;   // PT4M13S format
    channel: string;
}

export interface YouTubeChannelInfo {
    channelId: string;
    channelName: string;
    handle: string;
    uploadsPlaylistId: string;
    subscriberCount: number;
    totalVideoCount: number;
    description: string;
    thumbnail: string;
}

// ─── Step 1: Resolve channel info + uploads playlist ID ──────────────────────

export async function resolveChannel(
    apiKey: string,
    channelUrl: string
): Promise<YouTubeChannelInfo> {
    const cacheKey = `yt:resolve:${channelUrl}`;
    return cacheData(cacheKey, async () => {
        // Extract handle or channel ID from URL
        const handle = channelUrl.match(/\/@([A-Za-z0-9_.\-]+)/)?.[1];
        const channelId = channelUrl.match(/\/channel\/([A-Za-z0-9_\-]+)/)?.[1];
        const legacyName = channelUrl.match(/\/(?:c|user)\/([A-Za-z0-9_\-]+)/)?.[1];
        const bareName = channelUrl.match(/youtube\.com\/([A-Za-z0-9_\-]+)\/?$/)?.[1];

        let query: string;
        if (handle) {
            query = `forHandle=%40${encodeURIComponent(handle)}`;
        } else if (channelId) {
            query = `id=${channelId}`;
        } else if (legacyName) {
            query = `forUsername=${encodeURIComponent(legacyName)}`;
        } else if (bareName && !["watch", "feed", "results", "shorts"].includes(bareName.toLowerCase())) {
            query = `forHandle=%40${encodeURIComponent(bareName)}`;
        } else {
            throw new Error("Could not parse channel URL: " + channelUrl);
        }

        const url = `${YT_BASE}/channels?part=snippet,contentDetails,statistics&${query}&key=${apiKey}`;
        const res = await fetch(url);

        if (!res.ok) {
            const err = await res.json() as { error?: { message: string; code: number } };
            if (err.error?.code === 403) throw new Error("QUOTA_EXCEEDED");
            throw new Error(`YouTube API error: ${err.error?.message ?? res.statusText}`);
        }

        const data = await res.json() as {
            items?: Array<{
                id: string;
                snippet: { title: string; description: string; customUrl?: string; thumbnails?: { default?: { url: string } } };
                contentDetails: { relatedPlaylists: { uploads: string } };
                statistics: { subscriberCount?: string; videoCount?: string };
            }>;
        };

        const ch = data.items?.[0];
        if (!ch) throw new Error("Channel not found. Check the URL is correct.");

        return {
            channelId: ch.id,
            channelName: ch.snippet.title,
            handle: ch.snippet.customUrl ?? handle ?? channelId ?? "unknown",
            uploadsPlaylistId: ch.contentDetails.relatedPlaylists.uploads,
            subscriberCount: parseInt(ch.statistics.subscriberCount ?? "0"),
            totalVideoCount: parseInt(ch.statistics.videoCount ?? "0"),
            description: ch.snippet.description.slice(0, 500),
            thumbnail: ch.snippet.thumbnails?.default?.url || "",
        };
    }, 86400); // 24 hour cache for channel info
}

// ─── Step 2: Paginate through all video IDs in uploads playlist ───────────────

export async function getAllVideoIds(
    apiKey: string,
    uploadsPlaylistId: string,
    maxVideos = 500  // 500 default, adjustable per tier
): Promise<string[]> {
    const videoIds: string[] = [];
    let pageToken: string | undefined;

    do {
        const url = `${YT_BASE}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ""}&key=${apiKey}`;
        const res = await fetch(url);

        if (!res.ok) {
            const err = await res.json() as { error?: { code: number; message: string } };
            if (err.error?.code === 403) throw new Error("QUOTA_EXCEEDED");
            break;
        }

        const data = await res.json() as {
            items?: Array<{ contentDetails: { videoId: string } }>;
            nextPageToken?: string;
        };

        const ids = (data.items ?? []).map((item) => item.contentDetails.videoId);
        videoIds.push(...ids);
        pageToken = data.nextPageToken;

    } while (pageToken && videoIds.length < maxVideos);

    return videoIds.slice(0, maxVideos);
}

// ─── Step 3: Fetch video stats in batches of 50 ───────────────────────────────

export async function getVideoStats(
    apiKey: string,
    videoIds: string[],
    channelName: string
): Promise<YouTubeVideo[]> {
    const videos: YouTubeVideo[] = [];

    for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50).join(",");
        const url = `${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${batch}&key=${apiKey}`;
        const res = await fetch(url);

        if (!res.ok) {
            const err = await res.json() as { error?: { code: number } };
            if (err.error?.code === 403) throw new Error("QUOTA_EXCEEDED");
            continue;
        }

        const data = await res.json() as {
            items?: Array<{
                id: string;
                snippet: { title: string; publishedAt: string; channelTitle: string };
                statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
                contentDetails: { duration: string };
            }>;
        };

        for (const item of (data.items ?? [])) {
            videos.push({
                videoId: item.id,
                title: item.snippet.title,
                views: parseInt(item.statistics.viewCount ?? "0"),
                likes: parseInt(item.statistics.likeCount ?? "0"),
                comments: parseInt(item.statistics.commentCount ?? "0"),
                uploadDate: item.snippet.publishedAt,
                duration: item.contentDetails.duration,
                channel: item.snippet.channelTitle || channelName,
            });
        }
    }

    return videos;
}

// ─── Full pipeline: URL → all videos ─────────────────────────────────────────

export async function fetchFullChannelData(
    apiKey: string,
    channelUrl: string,
    maxVideos = 100
): Promise<{ channelInfo: YouTubeChannelInfo; videos: YouTubeVideo[] }> {
    const cacheKey = `yt:fullChannel:${channelUrl}:${maxVideos}`;
    return cacheData(cacheKey, async () => {
        const channelInfo = await resolveChannel(apiKey, channelUrl);
        const videoIds = await getAllVideoIds(apiKey, channelInfo.uploadsPlaylistId, maxVideos);
        const videos = await getVideoStats(apiKey, videoIds, channelInfo.channelName);

        // Sort newest first
        videos.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

        return { channelInfo, videos };
    }, 7200); // 2 hour cache for full channel history
}

// ─── Quota cost estimator ─────────────────────────────────────────────────────
// channels.list:      1 unit
// playlistItems.list: 1 unit × pages (~10 pages per 500 videos)
// videos.list:        1 unit × batches (~10 batches per 500 videos)
// Total for 500 videos: ~21 units (out of 10,000/day free)
