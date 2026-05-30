import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitorMonitors, competitorInsights, ideaVault } from "@/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { getRandomYouTubeApiKey } from "@/lib/youtube-server";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { auth } from "@/auth";
import { getUserByEmail, deductUserCredits } from "@/db/queries";

export const maxDuration = 60; // Vercel Hobby plan max for streaming/Next.js config

import { resolveChannel } from "@/lib/engine/youtube-api";

// ── Triple-layer Shorts detection ─────────────────────────────────────────────
function parseDurationSeconds(isoDuration: string): number {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const h = parseInt(match[1] || "0", 10);
    const m = parseInt(match[2] || "0", 10);
    const s = parseInt(match[3] || "0", 10);
    return h * 3600 + m * 60 + s;
}

function isYouTubeShort(title: string, duration: string, tags: string[] = []): boolean {
    const seconds = parseDurationSeconds(duration);

    // Layer 1: Hard duration cutoff — anything <= 90s is a Short
    if (seconds > 0 && seconds <= 90) return true;

    // Layer 2: Title heuristics — common Short indicators in title/description
    const titleLower = (title || "").toLowerCase();
    if (
        titleLower.includes("#shorts") ||
        titleLower.includes("#short") ||
        titleLower.includes(" short ") ||
        titleLower.endsWith(" short") ||
        titleLower.startsWith("short ") ||
        titleLower.includes("60 second") ||
        titleLower.includes("60s ")
    ) return true;

    // Layer 3: Tags check
    const tagStr = tags.map(t => t.toLowerCase()).join(" ");
    if (tagStr.includes("shorts") || tagStr.includes("#shorts")) return true;

    return false;
}

export async function POST(req: NextRequest) {
    const { monitorId } = await req.json();

    if (!monitorId) return NextResponse.json({ error: "Missing monitorId" }, { status: 400 });

    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.credits < 1) {
        return NextResponse.json({ error: "Insufficient credits. Please upgrade your plan." }, { status: 403 });
    }

    try {
        const [monitor] = await db.select().from(competitorMonitors).where(eq(competitorMonitors.id, monitorId));
        if (!monitor) return NextResponse.json({ error: "Monitor not found" }, { status: 404 });

        const apiKey = getRandomYouTubeApiKey();
        if (!apiKey) return NextResponse.json({ error: "YouTube API key not configured" }, { status: 503 });

        // competitorChannelId now stores the actual uploads playlist ID directly
        // (set during monitor creation via resolveChannel's uploadsPlaylistId field)
        // Fall back to UC→UU conversion or full resolution for any legacy monitors added before this fix
        let uploadsPlaylistId = monitor.competitorChannelId;
        if (!uploadsPlaylistId.startsWith("UU") && !uploadsPlaylistId.startsWith("UC")) {
            // It's likely a legacy handle (e.g. @username)
            try {
                const urlOrHandle = `https://youtube.com/${uploadsPlaylistId.startsWith("@") ? "" : "@"}${uploadsPlaylistId.replace("@", "")}`;
                const channelInfo = await resolveChannel(apiKey, urlOrHandle);
                uploadsPlaylistId = channelInfo.uploadsPlaylistId || channelInfo.channelId.replace(/^UC/, "UU");
                
                // Heal the database with the resolved ID for future scans
                await db.update(competitorMonitors)
                    .set({ competitorChannelId: uploadsPlaylistId })
                    .where(eq(competitorMonitors.id, monitor.id));
            } catch (err) {
                console.error("[Watchtower] Failed to resolve legacy handle:", uploadsPlaylistId);
                return NextResponse.json({ error: "Could not resolve competitor YouTube channel" }, { status: 404 });
            }
        } else if (uploadsPlaylistId.startsWith("UC")) {
            uploadsPlaylistId = uploadsPlaylistId.replace(/^UC/, "UU");
        }

        console.log(`[Watchtower Scan] Starting scan for ${monitor.competitorHandle} (playlist: ${uploadsPlaylistId})`);

        // Fetch latest 50 uploads to ensure enough long-form candidates after filtering Shorts
        const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`;
        const playlistRes = await fetch(playlistUrl);
        const playlistData = await playlistRes.json();

        if (!playlistData.items?.length) {
            console.error(`[Watchtower Scan] No playlist items found. Playlist: ${uploadsPlaylistId}`, playlistData?.error);
            return NextResponse.json({ error: "No videos found for this channel" }, { status: 404 });
        }

        // ── Step 2: Fetch full metadata (stats + contentDetails + tags) ──────
        const videoIds = playlistData.items.map((v: any) => v.contentDetails.videoId).join(",");
        const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${apiKey}`;
        const statsRes = await fetch(statsUrl);
        const statsData = await statsRes.json();

        if (!statsData.items?.length) {
            return NextResponse.json({ error: "Could not fetch video metadata" }, { status: 404 });
        }

        // ── Step 3: Filter – strictly long-form only ──────────────────────────
        const longFormVideos = statsData.items
            .filter((item: any) => {
                const title = item.snippet?.title || "";
                const duration = item.contentDetails?.duration || "";
                const tags: string[] = item.snippet?.tags || [];
                return !isYouTubeShort(title, duration, tags);
            })
            .map((item: any) => {
                const durationSec = parseDurationSeconds(item.contentDetails?.duration || "");
                const mins = Math.floor(durationSec / 60);
                const secs = durationSec % 60;
                return {
                    id: item.id,
                    title: item.snippet?.title || "Untitled",
                    description: (item.snippet?.description || "").slice(0, 300),
                    thumbnail: item.snippet?.thumbnails?.maxres?.url
                        || item.snippet?.thumbnails?.high?.url
                        || item.snippet?.thumbnails?.default?.url || "",
                    publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
                    views: item.statistics?.viewCount ?? "0",
                    likes: item.statistics?.likeCount ?? "0",
                    comments: item.statistics?.commentCount ?? "0",
                    duration: `${mins}:${String(secs).padStart(2, "0")}`,
                    durationSeconds: durationSec,
                    tags: (item.snippet?.tags || []).slice(0, 10),
                };
            })
            // Sort by most recent first
            .sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

        if (longFormVideos.length === 0) {
            return NextResponse.json({ error: "No long-form videos found — all recent uploads are Shorts" }, { status: 404 });
        }

        // ── Step 4: AI Analysis – top 5 long-form videos ─────────────────────
        const groqKeys = [
            process.env.GROQ_API_KEY,
            process.env.GROQ_API_KEY_2,
            process.env.GROQ_API_KEY_3,
        ].filter(Boolean) as string[];

        if (groqKeys.length === 0) {
            return NextResponse.json({ error: "Groq API keys not configured" }, { status: 503 });
        }

        const analyzedInsights = [];
        let activeGroqKeyIndex = 0;

        for (const video of longFormVideos.slice(0, 5)) {
            // Reuse cached insight if already analyzed
            const [existing] = await db.select().from(competitorInsights).where(eq(competitorInsights.videoId, video.id));
            if (existing) {
                // Fix the 82% hardcode bug on cached items by recalculating
                const analysisObj = existing.analysis as any;
                const cachedEr = parseFloat(analysisObj?.engagementRate || "4");
                const cachedViewLog = Math.log10(Math.max(1000, parseInt(existing.views || "0")));
                let cachedScore = Math.floor((cachedEr * 8) + (cachedViewLog * 6));
                if (cachedScore > 99) cachedScore = 99;
                if (cachedScore < 12) cachedScore = 12;
                if (analysisObj) analysisObj.viralityScore = cachedScore;
                
                // Update DB to heal the data
                await db.update(competitorInsights).set({ analysis: existing.analysis }).where(eq(competitorInsights.id, existing.id));

                if (existing.monitorId === monitorId) {
                    analyzedInsights.push(existing);
                } else {
                    // Clone the insight for the new monitor to save AI tokens but maintain correct relational links
                    const [cloned] = await db.insert(competitorInsights).values({
                        monitorId,
                        videoId: video.id,
                        title: video.title,
                        thumbnail: video.thumbnail,
                        views: video.views,
                        publishedAt: new Date(video.publishedAt),
                        analysis: existing.analysis,
                    }).returning();
                    analyzedInsights.push(cloned);
                }
                continue;
            }

            const engagementRate = video.views > 0
                ? ((parseInt(video.likes) + parseInt(video.comments)) / parseInt(video.views) * 100).toFixed(2)
                : "0";

            const prompt = `You are an elite YouTube growth strategist analyzing a competitor's long-form video.

VIDEO DATA:
- Title: "${video.title}"
- Duration: ${video.duration}
- Views: ${parseInt(video.views).toLocaleString()}
- Likes: ${parseInt(video.likes).toLocaleString()}
- Comments: ${parseInt(video.comments).toLocaleString()}
- Engagement Rate: ${engagementRate}%
- Published: ${new Date(video.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
- Description Preview: "${video.description}"
- Top Tags: ${video.tags.join(", ") || "none"}

Provide a rich, actionable analysis as JSON with EXACTLY these fields:
{
  "whyItWorked": "2-3 sentence explanation of the psychological hook, format, and trending timing that made this video successful",
  "theGap": "A specific, concrete content opportunity this video failed to address that you could exploit",
  "suggestedHook": "A specific 10-second opening script (verbatim, ready to record) that would capture this audience with a fresh angle",
  "counterTitle": "An irresistible alternative YouTube title that would compete directly and win clicks from the same audience",
  "targetKeywords": "3 comma-separated high-value search keywords this video ranks for that you should also target",
  "contentAngle": "The unique narrative angle or framework (e.g., Beginner Mistake, Contrarian Take, Case Study, Step-by-Step) to use",
  "estimatedProductionTime": "Estimated time to produce this format in hours (integer only)"
}

Return ONLY the raw JSON object. No markdown. No explanation. Ensure estimatedProductionTime is an actual JSON number, not a string.`;

            try {
                const currentKey = groqKeys[activeGroqKeyIndex % groqKeys.length];
                activeGroqKeyIndex++;
                const groqProvider = createGroq({ apiKey: currentKey });
                const groqModel = groqProvider("llama-3.3-70b-versatile");

                const { text } = await generateText({ model: groqModel, prompt });
                
                let cleaned = text.trim();
                const start = cleaned.indexOf("{");
                const end = cleaned.lastIndexOf("}");
                if (start !== -1 && end !== -1) {
                    cleaned = cleaned.slice(start, end + 1);
                } else {
                    cleaned = cleaned.replace(/```json|```/g, "").trim();
                }
                const analysis = JSON.parse(cleaned);

                const erNum = parseFloat(engagementRate);
                const viewLog = Math.log10(Math.max(1000, parseInt(video.views)));
                let calcScore = Math.floor((erNum * 8) + (viewLog * 6));
                if (calcScore > 99) calcScore = 99;
                if (calcScore < 12) calcScore = 12;

                const [newInsight] = await db.insert(competitorInsights).values({
                    monitorId,
                    videoId: video.id,
                    title: video.title,
                    thumbnail: video.thumbnail,
                    views: video.views,
                    publishedAt: new Date(video.publishedAt),
                    analysis: {
                        ...analysis,
                        viralityScore: calcScore,
                        // Attach raw metrics for UI display
                        likes: video.likes,
                        comments: video.comments,
                        duration: video.duration,
                        engagementRate,
                        tags: video.tags,
                    },
                }).returning();

                analyzedInsights.push(newInsight);

                // (Auto-inject logic removed to allow manual saving only)
            } catch (parseErr) {
                console.error("[Watchtower] AI Analysis Parse Error:", parseErr);
            }
        }

        // Update last scanned timestamp
        await db.update(competitorMonitors)
            .set({ lastScannedAt: new Date() })
            .where(eq(competitorMonitors.id, monitorId));

        // Deduct credit
        await deductUserCredits(user.id, 1, "Watchtower Scan");

        return NextResponse.json({
            analyzed: analyzedInsights.length,
            totalLongForm: longFormVideos.length,
            insights: analyzedInsights,
        });

    } catch (e) {
        console.error("Watchtower Scan Error:", e);
        return NextResponse.json({ error: "Failed to scan competitor" }, { status: 500 });
    }
}
