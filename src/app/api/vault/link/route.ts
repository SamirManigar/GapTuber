import { NextResponse } from "next/server";
import { db } from "@/db";
import { ideaVault, baselinePerformance, videoPerformanceSnapshots, channels } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getYouTubeVideoMetadata, getHistoricalVideoViews } from "@/lib/youtube-analytics";
import { getRandomYouTubeApiKey, getRecentChannelVideos } from "@/lib/youtube-server";
import { getValidYouTubeToken } from "@/lib/youtube-tokens";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { vaultIdeaId, youtubeUrl } = body;

        if (!vaultIdeaId || !youtubeUrl) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // Extract Video ID
        const videoIdMatch = youtubeUrl.match(/(?:v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
        const youtubeVideoId = videoIdMatch ? videoIdMatch[1] : youtubeUrl;

        // Get Vault Idea
        const vaultIdea = await db.query.ideaVault.findFirst({
            where: eq(ideaVault.id, vaultIdeaId)
        });

        if (!vaultIdea) {
            return NextResponse.json({ success: false, error: "Idea not found" }, { status: 404 });
        }

        // Get Channel and YouTube Auth Token
        const channel = await db.query.channels.findFirst({
            where: and(
                eq(channels.id, vaultIdea.channelId),
                eq(channels.userId, session.user.id) // Enforce Ownership
            )
        });

        if (!channel) {
            return NextResponse.json({ success: false, error: "Channel not found or unauthorized" }, { status: 404 });
        }

        const ytApiKey = getRandomYouTubeApiKey();

        // 1. Validate video exists and get metadata via Data API
        const videoMeta = await getYouTubeVideoMetadata(youtubeVideoId, ytApiKey);
        if (!videoMeta) {
            return NextResponse.json({ success: false, error: "Invalid YouTube Video" }, { status: 400 });
        }

        const accessToken = channel.youtubeAccessToken
            ? (await getValidYouTubeToken(channel.id)).accessToken
            : null;

        if (!accessToken) {
            return NextResponse.json(
                { success: false, error: "Connect YouTube Analytics before linking a published outcome." },
                { status: 403 }
            );
        }

        const mineResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
        });
        const mineData = mineResponse.ok
            ? await mineResponse.json() as { items?: Array<{ id: string }> }
            : null;
        const authenticatedChannelId = mineData?.items?.[0]?.id;

        if (!authenticatedChannelId || videoMeta.channelId !== authenticatedChannelId) {
            logger.warn(`Video channel ${videoMeta.channelId} does not match the authenticated YouTube channel.`);
            return NextResponse.json(
                { success: false, error: "This video does not belong to the authenticated YouTube channel." },
                { status: 403 }
            );
        }

        if (channel.youtubeChannelId !== authenticatedChannelId) {
            await db.update(channels)
                .set({ youtubeChannelId: authenticatedChannelId })
                .where(eq(channels.id, channel.id));
        }
        let linkedPerformance: { day1: number | null; day7: number | null; day30: number | null } = {
            day1: null,
            day7: null,
            day30: null,
        };

        // If we have OAuth, fetch real metrics
        if (accessToken) {
            try {
                // Fetch historical performance for the linked video
                linkedPerformance = await getHistoricalVideoViews(youtubeVideoId, videoMeta.publishedAt, accessToken);

                // Compute Baseline (Fetch up to 15 prior videos)
                // In a real production system, you'd use Analytics API for all 15 videos.
                // To keep API quota low, we'll fetch the recent videos via Data API, filter those BEFORE this video,
                // and fetch their analytics.
                const recentVideos = await getRecentChannelVideos(channel.youtubeChannelId || videoMeta.channelId, ytApiKey, 30);
                const priorVideos = recentVideos
                    .filter(v => new Date(v.uploadDate) < videoMeta.publishedAt)
                    .slice(0, 15);

                const sampleSize = priorVideos.length;
                const day1Values = [], day7Values = [], day30Values = [];

                if (sampleSize > 0) {
                    for (const pv of priorVideos) {
                        try {
                            // We wait here since batch Analytics API for multiple dimensions is tricky
                            const pvStats = await getHistoricalVideoViews(pv.url.split("v=")[1], new Date(pv.uploadDate), accessToken);
                            if (pvStats.day1 !== null) day1Values.push(pvStats.day1);
                            if (pvStats.day7 !== null) day7Values.push(pvStats.day7);
                            if (pvStats.day30 !== null) day30Values.push(pvStats.day30);
                        } catch {
                            console.warn("Failed to get analytics for prior video:", pv.url);
                        }
                    }
                }

                // Calculate Medians
                const median = (arr: number[]) => {
                    if (!arr.length) return null;
                    const sorted = [...arr].sort((a, b) => a - b);
                    const mid = Math.floor(sorted.length / 2);
                    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
                };

                const day1Median = median(day1Values);
                const day7Median = median(day7Values);
                const day30Median = median(day30Values);

                // Check if baseline already exists for this idea/video pair
                const existingBaseline = await db.query.baselinePerformance.findFirst({
                    where: and(
                        eq(baselinePerformance.vaultIdeaId, vaultIdeaId),
                        eq(baselinePerformance.targetVideoId, youtubeVideoId)
                    )
                });

                if (!existingBaseline) {
                    // Insert Baseline
                    await db.insert(baselinePerformance).values({
                        channelId: channel.id,
                        vaultIdeaId: vaultIdeaId,
                        targetVideoId: youtubeVideoId,
                        baselineVideoIds: priorVideos.map(v => v.url.split("v=")[1]),
                        day1MedianViews: day1Median,
                        day7MedianViews: day7Median,
                        day30MedianViews: day30Median,
                        sampleSize: sampleSize,
                        confidence: sampleSize >= 5 ? "high" : "low"
                    });
                }

                // Insert Snapshots
                const snapshots = [];
                const outcomeMultipliers: Partial<Record<"day1" | "day7" | "day30", number>> = {};
                if (linkedPerformance.day1 !== null) {
                    const mult = day1Median ? (linkedPerformance.day1 / day1Median) : null;
                    snapshots.push({ snapshotType: "day1" as const, actualViews: linkedPerformance.day1, baselineViewsAtTime: day1Median, performanceMultiplier: mult });
                    if (mult !== null) outcomeMultipliers.day1 = mult;
                }
                if (linkedPerformance.day7 !== null) {
                    const mult = day7Median ? (linkedPerformance.day7 / day7Median) : null;
                    snapshots.push({ snapshotType: "day7" as const, actualViews: linkedPerformance.day7, baselineViewsAtTime: day7Median, performanceMultiplier: mult });
                    if (mult !== null) outcomeMultipliers.day7 = mult;
                }
                if (linkedPerformance.day30 !== null) {
                    const mult = day30Median ? (linkedPerformance.day30 / day30Median) : null;
                    snapshots.push({ snapshotType: "day30" as const, actualViews: linkedPerformance.day30, baselineViewsAtTime: day30Median, performanceMultiplier: mult });
                    if (mult !== null) outcomeMultipliers.day30 = mult;
                }

                if (snapshots.length > 0) {
                    await db.insert(videoPerformanceSnapshots).values(
                        snapshots.map(s => ({
                            vaultIdeaId,
                            youtubeVideoId,
                            snapshotType: s.snapshotType,
                            actualViews: s.actualViews,
                            baselineViewsAtTime: s.baselineViewsAtTime,
                            performanceMultiplier: s.performanceMultiplier
                        }))
                    ).onConflictDoNothing(); // Prevent duplicate inserts for same type
                }

                await db.update(ideaVault).set({
                    status: "launched",
                    youtubeVideoId,
                    publishedAt: videoMeta.publishedAt,
                    outcomeMultipliers: outcomeMultipliers,
                    updatedAt: new Date()
                }).where(eq(ideaVault.id, vaultIdeaId));

            } catch (analyticsErr) {
                logger.error("Analytics API Error", analyticsErr);
                // Fallback: Just link it if Analytics fails (e.g. invalid tokens, missing scopes)
                await db.update(ideaVault).set({
                    status: "launched",
                    youtubeVideoId,
                    publishedAt: videoMeta.publishedAt,
                    updatedAt: new Date()
                }).where(eq(ideaVault.id, vaultIdeaId));
            }
        } else {
            // Fallback: No OAuth tokens, just link metadata
            await db.update(ideaVault).set({
                status: "launched",
                youtubeVideoId,
                publishedAt: videoMeta.publishedAt,
                updatedAt: new Date()
            }).where(eq(ideaVault.id, vaultIdeaId));
        }

        return NextResponse.json({ success: true });

    } catch (err: unknown) {
        logger.error("[Vault Link Error]", err);
        return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Could not link video" }, { status: 500 });
    }
}
