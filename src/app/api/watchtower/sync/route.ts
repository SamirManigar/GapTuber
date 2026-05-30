import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitorMonitors, competitorInsights, ideaVault } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 300; // Allow up to 5 minutes for background sync of multiple monitors

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
    return handleSync(req);
}

export async function POST(req: NextRequest) {
    return handleSync(req);
}

async function handleSync(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channelId");

    try {
        // Fetch monitors to sync. If channelId is provided, sync only that channel's monitors.
        // Otherwise, sync all monitors in the system (limit to 50 per batch to avoid timeouts).
        let query = db.select().from(competitorMonitors);
        let monitors = await query;

        if (channelId) {
            monitors = monitors.filter(m => m.channelId === channelId);
        } else {
            monitors = monitors.slice(0, 50);
        }

        if (monitors.length === 0) {
            return NextResponse.json(
                { success: true, syncedCount: 0, message: "No competitor monitors found to sync." },
                { headers: CORS_HEADERS }
            );
        }

        const ytKeys = [
            process.env.YOUTUBE_API_KEY,
            process.env.YOUTUBE_API_KEY_2,
            process.env.YOUTUBE_API_KEY_3,
        ].filter(Boolean) as string[];

        const groqKeys = [
            process.env.GROQ_API_KEY,
            process.env.GROQ_API_KEY_2,
            process.env.GROQ_API_KEY_3,
        ].filter(Boolean) as string[];

        if (ytKeys.length === 0 || groqKeys.length === 0) {
            return NextResponse.json({ error: "API keys missing for sync service." }, { status: 503, headers: CORS_HEADERS });
        }

        let totalNewInsights = 0;
        let activeYtKeyIndex = 0;
        let activeGroqKeyIndex = 0;

        // Process each monitor sequentially or in small parallel batches
        for (const monitor of monitors) {
            try {
                // Resolve uploadsPlaylistId safely — the DB may store:
                //   "UU..." — already the uploads playlist ID (stored by scan route) → use as-is
                //   "UC..." — channel ID → convert to UU...
                //   anything else (legacy @handle) — skip and log, do not produce garbage
                let uploadsPlaylistId: string;
                const storedId = monitor.competitorChannelId;
                if (storedId.startsWith("UU")) {
                    uploadsPlaylistId = storedId;
                } else if (storedId.startsWith("UC")) {
                    uploadsPlaylistId = storedId.replace(/^UC/, "UU");
                } else {
                    logger.warn(`[Watchtower Sync] Skipping monitor ${monitor.id} — stored ID "${storedId}" is an unresolved handle. Run a manual scan first to heal the DB.`);
                    continue;
                }
                const currentYtKey = ytKeys[activeYtKeyIndex % ytKeys.length];
                
                const videosUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=5&key=${currentYtKey}`;
                const videosRes = await fetch(videosUrl);
                
                if (!videosRes.ok) {
                    // Rotate YouTube key on failure
                    activeYtKeyIndex++;
                    continue;
                }

                const videosData = await videosRes.json();
                if (!videosData.items || videosData.items.length === 0) continue;

                // Fetch view counts
                const videoIds = videosData.items.map((v: any) => v.contentDetails?.videoId).filter(Boolean).join(",");
                if (!videoIds) continue;

                const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${currentYtKey}`;
                const statsRes = await fetch(statsUrl);
                if (!statsRes.ok) continue;

                const statsData = await statsRes.json();
                const videosWithStats = videosData.items.map((v: any, index: number) => ({
                    id: v.contentDetails?.videoId,
                    title: v.snippet?.title,
                    thumbnail: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.default?.url,
                    publishedAt: v.snippet?.publishedAt,
                    views: statsData.items?.[index]?.statistics?.viewCount ?? "0",
                }));

                // AI Analysis for the top 3 most relevant/viewed recent videos
                for (const video of videosWithStats.slice(0, 3)) {
                    if (!video.id) continue;
                    // Check if insight already exists
                    const existing = await db.select().from(competitorInsights).where(eq(competitorInsights.videoId, video.id));
                    if (existing && existing.length > 0) continue;

                    const prompt = `
                        Analyze this high-performing YouTube video from a competitor:
                        Title: "${video.title}"
                        Views: ${video.views}
                        
                        You are a YouTube Growth Strategist. Provide a JSON response identifying:
                        1. whyItWorked: A brief explanation of the psychological hook or trend.
                        2. theGap: What they missed or how a smaller creator can "remix" this with a fresh angle.
                        3. suggestedHook: A high-CTR hook the user can use for their own version.

                        Return ONLY JSON.
                    `;

                    // Rotate Groq key per request to distribute load
                    const currentGroqKey = groqKeys[activeGroqKeyIndex % groqKeys.length];
                    activeGroqKeyIndex++;

                    const groq = createGroq({ apiKey: currentGroqKey });
                    const { text } = await generateText({
                        model: groq("llama-3.3-70b-versatile"),
                        messages: [
                            { role: "system", content: "Output valid JSON only. No markdown formatting." },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.3,
                    });

                    try {
                        let cleanedText = text.trim();
                        const start = cleanedText.indexOf("{");
                        const end = cleanedText.lastIndexOf("}");
                        if (start !== -1 && end !== -1) {
                            cleanedText = cleanedText.slice(start, end + 1);
                        } else {
                            if (cleanedText.startsWith("```json")) cleanedText = cleanedText.replace(/```json/g, "").replace(/```/g, "").trim();
                            else if (cleanedText.startsWith("```")) cleanedText = cleanedText.replace(/```/g, "").trim();
                        }

                        const analysis = JSON.parse(cleanedText);
                        
                        // Deterministic virality math to fix 82% bug
                        const erNum = video.views > 0 ? ((parseInt(statsData.items?.[0]?.statistics?.likeCount ?? "0") + parseInt(statsData.items?.[0]?.statistics?.commentCount ?? "0")) / parseInt(video.views) * 100) : 0;
                        const viewLog = Math.log10(Math.max(1000, parseInt(video.views)));
                        let calcScore = Math.floor((erNum * 8) + (viewLog * 6));
                        if (calcScore > 99) calcScore = 99;
                        if (calcScore < 12) calcScore = 12;

                        const fullAnalysis = { ...analysis, viralityScore: calcScore };

                        await db.insert(competitorInsights).values({
                            monitorId: monitor.id,
                            videoId: video.id,
                            title: video.title || "Untitled",
                            thumbnail: video.thumbnail,
                            views: String(video.views),
                            publishedAt: new Date(video.publishedAt || Date.now()),
                            analysis: fullAnalysis,
                        });
                        totalNewInsights++;

                        // Tier 3C: auto-inject high-virality signals as vault ideas
                        if (calcScore >= 80) {
                            try {
                                const [monitorRow] = await db
                                    .select()
                                    .from(competitorMonitors)
                                    .where(eq(competitorMonitors.id, monitor.id))
                                    .limit(1);

                                if (monitorRow?.channelId) {
                                    const shortTitle = video.title?.slice(0, 30) || "";
                                    const existingVaultIdea = await db.query.ideaVault.findFirst({
                                        where: (iv, { eq, and, like }) => and(
                                            eq(iv.channelId, monitorRow.channelId),
                                            like(iv.title, `%${shortTitle}%`)
                                        )
                                    });

                                    if (!existingVaultIdea) {
                                        await db.insert(ideaVault).values({
                                            channelId: monitorRow.channelId,
                                            title: `[SIGNAL] Remix: ${video.title}`,
                                            hook: fullAnalysis.suggestedHook || `Start with: "${fullAnalysis.whyItWorked?.slice(0, 100)}..."`,
                                            format: "Competitor Remix",
                                            whyItWorks: `Virality Score ${calcScore}/100 — ${fullAnalysis.theGap}`,
                                            estimatedViewPotential: calcScore >= 90 ? "high" : "medium",
                                            targetAudience: "Your existing audience",
                                            source: "watchtower",
                                            status: "backlog",
                                            script: "",
                                        });
                                        logger.info(`[Watchtower] Auto-injected viral idea for channel ${monitorRow.channelId}: ${video.title}`);
                                    }
                                }
                            } catch (injectErr) {
                                logger.warn("[Watchtower] Auto-inject failed (non-critical)", injectErr);
                            }
                        }
                    } catch (parseErr) {
                        logger.warn("[Watchtower Sync] Failed to parse AI insight output", parseErr);
                    }
                }

                // Update last scanned timestamp
                await db.update(competitorMonitors).set({ lastScannedAt: new Date() }).where(eq(competitorMonitors.id, monitor.id));

            } catch (monitorErr) {
                logger.error(`[Watchtower Sync] Error processing monitor ${monitor.id}`, monitorErr);
            }
        }

        return NextResponse.json({
            success: true,
            syncedMonitorsCount: monitors.length,
            newInsightsGenerated: totalNewInsights,
            timestamp: new Date().toISOString()
        }, { headers: CORS_HEADERS });

    } catch (err) {
        logger.error("[Watchtower Sync Service Error]", err);
        Sentry.captureException(err, {
            tags: { service: "watchtower-sync", channelId: channelId || "global" }
        });
        return NextResponse.json({ error: "Background sync execution failed." }, { status: 500, headers: CORS_HEADERS });
    }
}
