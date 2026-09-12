// @ts-nocheck
import { inngest } from "./client";
import { db } from "@/db";
import { trackedVideos, videoMetricSnapshots } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { OUTLIER_CONFIG } from "@/lib/engine/config";
import { getRandomYouTubeApiKey, getVideoStats } from "@/lib/youtube-server";

// @ts-ignore
export const trackBreakoutCandidate = inngest.createFunction(
    { id: "track-breakout-candidate", triggers: [{ event: "engine/outlier.detected" }] },
    async ({ event, step }: any) => {
        const { videoId, trackingId, detectedAt, searchRunId } = event.data;
        const detectedTime = new Date(detectedAt);

        // Helper to perform the capture
        const captureAt = async (offsetHours: number, stepName: string) => {
            const targetTime = new Date(detectedTime.getTime() + offsetHours * 60 * 60 * 1000);
            
            // Wait for the absolute target timestamp
            await step.sleepUntil(`wait-${stepName}`, targetTime);

            // Execute the capture
            await step.run(`capture-${stepName}`, async () => {
                const apiKey = getRandomYouTubeApiKey();
                if (!apiKey) throw new Error("No YouTube API key available");

                const videos = await getVideoStats([videoId], apiKey);
                if (videos.length === 0) {
                    throw new Error("Video data unavailable or private");
                }
                const v = videos[0];

                // Idempotent insertion
                await db.insert(videoMetricSnapshots).values({
                    trackingId,
                    videoId,
                    targetOffsetHours: offsetHours,
                    scheduledFor: targetTime,
                    capturedAt: new Date(),
                    views: parseInt(v.statistics?.viewCount || "0"),
                    likes: parseInt(v.statistics?.likeCount || "0"),
                    comments: parseInt(v.statistics?.commentCount || "0"),
                    captureTrigger: `T+${offsetHours}`,
                    collectorVersion: OUTLIER_CONFIG.collectorVersion,
                }).onConflictDoNothing(); // Handled by unique(trackingId, offsetHours)

                // Update tracked_videos with the latest snapshot time
                await db.update(trackedVideos)
                    .set({ lastSnapshotAt: new Date(), updatedAt: new Date() })
                    .where(eq(trackedVideos.id, trackingId));

                return { success: true, views: v.statistics?.viewCount };
            });
        };

        // Enqueue the captures defined in the config (skip T0 if we assume it's already captured at detection)
        for (const offset of OUTLIER_CONFIG.snapshotOffsetsHours) {
            if (offset === 0) continue; // T0 is handled synchronously
            await captureAt(offset, `t${offset}`);
        }

        // Finalize tracking
        await step.run("complete-tracking", async () => {
            await db.update(trackedVideos)
                .set({ status: "COMPLETED", updatedAt: new Date() })
                .where(eq(trackedVideos.id, trackingId));
        });
    }
);
