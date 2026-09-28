import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { getChannelById, updateChannelYoutubeTokens } from "@/db/queries";
import { getValidYouTubeToken, getTokenErrorMessage } from "@/lib/youtube-tokens";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { eq } from "drizzle-orm";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

async function refreshAccessToken(refreshToken: string) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });
    return res.json();
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channelId");

    if (!channelId) {
        return NextResponse.json({ error: "No channel ID provided." }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const channel = await getChannelById(channelId);
    // Validate channel ownership
    if (!channel || channel.userId !== session.user.id) {
        return NextResponse.json({ error: "Project channel not found or unauthorized." }, { status: 404 });
    }

    // Resolve a valid (auto-refreshed if needed) access token
    let accessToken: string;
    try {
        const result = await getValidYouTubeToken(channelId);
        accessToken = result.accessToken;
    } catch (err) {
        const { status, message } = getTokenErrorMessage(err);
        return NextResponse.json({ error: message }, { status });
    }

    try {
        // Fetch channel info
        const channelRes = await fetch(
            `${YOUTUBE_API_BASE}/channels?part=snippet,statistics,brandingSettings&mine=true`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const channelData = await channelRes.json();
        const ytChannel = channelData.items?.[0];

        if (!ytChannel || channelData.error) {
            return NextResponse.json(
                { error: channelData.error?.message || "Channel not found" },
                { status: 403 }
            );
        }

        // Save the actual YouTube channel ID to the channel's record if not already saved
        if (!channel.youtubeChannelId) {
            await updateChannelYoutubeTokens(channel.id, {
                accessToken,
                refreshToken: channel.youtubeRefreshToken,
                expiresAt: channel.youtubeTokenExpiresAt,
                youtubeChannelId: ytChannel.id,
            });
        }

        // Update branding data (logo, subs) if missing or changed
        const currentBranding = channel.brandingData as any || {};
        const thumbnail = ytChannel.snippet?.thumbnails?.high?.url || ytChannel.snippet?.thumbnails?.default?.url;
        const subscribers = ytChannel.statistics?.subscriberCount || "0";
        if (currentBranding.thumbnail !== thumbnail || currentBranding.subscribers !== subscribers) {
            await db.update(channels)
                .set({
                    brandingData: { ...currentBranding, thumbnail, subscribers }
                })
                .where(eq(channels.id, channel.id));
        }

        // Fetch latest 10 videos
        const videosRes = await fetch(
            `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${ytChannel.id}&maxResults=10&order=date&type=video`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const videosData = await videosRes.json();

        // Fetch video stats for each video
        const videoIds = videosData.items
            ?.map((v: any) => v.id.videoId)
            .filter(Boolean)
            .join(",");

        let videoStats: any[] = [];
        if (videoIds) {
            const statsRes = await fetch(
                `${YOUTUBE_API_BASE}/videos?part=statistics,snippet,contentDetails&id=${videoIds}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const statsData = await statsRes.json();
            videoStats = statsData.items ?? [];
        }

        return NextResponse.json({
            channel: {
                id: ytChannel.id,
                title: ytChannel.snippet?.title,
                description: ytChannel.snippet?.description,
                thumbnail: ytChannel.snippet?.thumbnails?.high?.url,
                customUrl: ytChannel.snippet?.customUrl,
                subscribers: ytChannel.statistics?.subscriberCount,
                views: ytChannel.statistics?.viewCount,
                videoCount: ytChannel.statistics?.videoCount,
            },
            videos: videoStats.map((v: any) => {
                // Determine if video is a Short (< 60s)
                const durationIso = v.contentDetails?.duration || "PT0S";
                const isShort = durationIso.match(/PT(\d+M)?(\d+S)?/);
                let durationSecs = 0;
                if (isShort) {
                    const mins = isShort[1] ? parseInt(isShort[1].replace('M', '')) : 0;
                    const secs = isShort[2] ? parseInt(isShort[2].replace('S', '')) : 0;
                    durationSecs = (mins * 60) + secs;
                }
                const classifyAsShort = durationSecs > 0 && durationSecs <= 61;

                return {
                    id: v.id,
                    title: v.snippet?.title,
                    thumbnail: v.snippet?.thumbnails?.medium?.url,
                    publishedAt: v.snippet?.publishedAt,
                    views: v.statistics?.viewCount,
                    likes: v.statistics?.likeCount,
                    comments: v.statistics?.commentCount,
                    duration: durationIso,
                    type: classifyAsShort ? "short" : "video"
                };
            }),
        });
    } catch (error) {
        console.error("[YouTube API]", error);
        return NextResponse.json(
            { error: "Failed to fetch YouTube data." },
            { status: 500 }
        );
    }
}
