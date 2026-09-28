import { NextResponse } from "next/server";
import { db } from "@/db";
import { ideaVault, videoPerformanceSnapshots, channels, baselinePerformance } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { getHistoricalVideoViews } from "@/lib/youtube-analytics";
import { getValidYouTubeToken } from "@/lib/youtube-tokens";
import { logger } from "@/lib/logger";
import { env } from "@/env";

// To be called via a daily cron schedule (e.g. Vercel Cron or external service)
export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get("authorization");
        if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Find all launched ideas that have a youtubeVideoId, publishedAt, and don't yet have a Day 30 snapshot
        // To be safe, we fetch all launched ideas with youtubeVideoId and check what snapshots they are missing.
        const launchedVaults = await db.query.ideaVault.findMany({
            where: and(
                eq(ideaVault.status, "launched"),
                isNotNull(ideaVault.youtubeVideoId),
                isNotNull(ideaVault.publishedAt)
            )
        });

        let processed = 0;
        let updated = 0;

        for (const vault of launchedVaults) {
            const channel = await db.query.channels.findFirst({
                where: eq(channels.id, vault.channelId)
            });
            if (!channel?.youtubeAccessToken) continue;

            const existingSnapshots = await db.query.videoPerformanceSnapshots.findMany({
                where: eq(videoPerformanceSnapshots.vaultIdeaId, vault.id)
            });

            const hasDay1 = existingSnapshots.some(s => s.snapshotType === "day1");
            const hasDay7 = existingSnapshots.some(s => s.snapshotType === "day7");
            const hasDay30 = existingSnapshots.some(s => s.snapshotType === "day30");

            if (hasDay1 && hasDay7 && hasDay30) continue; // Fully tracked

            processed++;

            try {
                const { accessToken } = await getValidYouTubeToken(channel.id);
                const linkedPerformance = await getHistoricalVideoViews(vault.youtubeVideoId!, vault.publishedAt!, accessToken);

                // Fetch latest baseline for this channel to compare against
                const baseline = await db.query.baselinePerformance.findFirst({
                    where: and(
                        eq(baselinePerformance.channelId, channel.id),
                        eq(baselinePerformance.vaultIdeaId, vault.id),
                        eq(baselinePerformance.targetVideoId, vault.youtubeVideoId!)
                    ),
                });

                const snapshotsToInsert: Array<{
                    snapshotType: "day1" | "day7" | "day30";
                    actualViews: number;
                    baselineViewsAtTime: number | null;
                    performanceMultiplier: number | null;
                }> = [];
                const outcomeMultipliers: Partial<Record<"day1" | "day7" | "day30", number>> = vault.outcomeMultipliers || {};
                let vaultNeedsUpdate = false;

                const checkAndQueue = (type: "day1" | "day7" | "day30", actual: number | null, median: number | null) => {
                    if (actual !== null) {
                        const mult = median ? (actual / median) : null;
                        snapshotsToInsert.push({ snapshotType: type, actualViews: actual, baselineViewsAtTime: median, performanceMultiplier: mult });
                        if (mult !== null) outcomeMultipliers[type] = mult;
                        vaultNeedsUpdate = true;
                    }
                };

                if (!hasDay1) checkAndQueue("day1", linkedPerformance.day1, baseline?.day1MedianViews ?? null);
                if (!hasDay7) checkAndQueue("day7", linkedPerformance.day7, baseline?.day7MedianViews ?? null);
                if (!hasDay30) checkAndQueue("day30", linkedPerformance.day30, baseline?.day30MedianViews ?? null);

                if (snapshotsToInsert.length > 0) {
                    await db.insert(videoPerformanceSnapshots).values(
                        snapshotsToInsert.map(s => ({
                            vaultIdeaId: vault.id,
                            youtubeVideoId: vault.youtubeVideoId!,
                            snapshotType: s.snapshotType,
                            actualViews: s.actualViews,
                            baselineViewsAtTime: s.baselineViewsAtTime,
                            performanceMultiplier: s.performanceMultiplier
                        }))
                    ).onConflictDoNothing();

                    if (vaultNeedsUpdate) {
                        await db.update(ideaVault)
                            .set({ outcomeMultipliers, updatedAt: new Date() })
                            .where(eq(ideaVault.id, vault.id));
                    }
                    updated++;
                }

            } catch (err) {
                logger.error(`[Cron] Error processing vault ${vault.id}`, err);
            }
        }

        return NextResponse.json({ success: true, processed, updated });

    } catch (err: unknown) {
        logger.error("[Cron Snapshot Error]", err);
        return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Snapshot update failed" }, { status: 500 });
    }
}
