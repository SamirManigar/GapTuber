import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitorMonitors, competitorInsights } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { getRandomYouTubeApiKey } from "@/lib/youtube-server";
import { logger } from "@/lib/logger";
import { auth } from "@/auth";
import { getUserByEmail } from "@/db/queries";
import { resolveChannel } from "@/lib/engine/youtube-api";

const ChannelIdParam = z.string().uuid();

const AddCompetitorSchema = z.object({
    channelId: z.string().uuid(),
    handle: z.string().min(1).max(100).trim(),
});

// List all monitored competitors for a channel
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const rawId = searchParams.get("channelId");

    const idParsed = ChannelIdParam.safeParse(rawId);
    if (!idParsed.success) {
        return NextResponse.json({ error: "Missing or invalid channelId" }, { status: 400 });
    }
    const channelId = idParsed.data;

    try {
        const monitors = await db.select()
            .from(competitorMonitors)
            .where(eq(competitorMonitors.channelId, channelId))
            .orderBy(desc(competitorMonitors.createdAt));

        // Manually fetch insights for each monitor
        const monitorsWithInsights = await Promise.all(monitors.map(async (m) => {
            const insights = await db.select()
                .from(competitorInsights)
                .where(eq(competitorInsights.monitorId, m.id))
                .orderBy(desc(competitorInsights.publishedAt))
                .limit(5);
            return { ...m, insights };
        }));

        return NextResponse.json(monitorsWithInsights);
    } catch (e) {
        logger.error("Watchtower GET Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// Add a new competitor monitor
export async function POST(req: NextRequest) {
    let rawBody: unknown;
    try {
        rawBody = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = AddCompetitorSchema.safeParse(rawBody);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid request", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { channelId, handle } = parsed.data;

    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    try {
        // Enforce tier limits
        const existingMonitors = await db.select()
            .from(competitorMonitors)
            .where(eq(competitorMonitors.channelId, channelId));

        if (user.tier === "free" && existingMonitors.length >= 2) {
            return NextResponse.json(
                { error: "Free tier is limited to 2 competitors per project. Please upgrade to add more." },
                { status: 403 }
            );
        }

        // 1. Fetch channel info from YouTube API using resolveChannel (1 quota unit instead of 100!)
        const apiKey = getRandomYouTubeApiKey();
        const cleanHandle = handle.trim();
        const urlOrHandle = cleanHandle.startsWith("http") ? cleanHandle : `https://youtube.com/${cleanHandle.startsWith("@") ? "" : "@"}${cleanHandle.replace("@", "")}`;
        
        const channelInfo = await resolveChannel(apiKey, urlOrHandle);

        // Store the real uploadsPlaylistId so the scan route doesn't need UC→UU conversion
        // which is unreliable for some channel ID formats
        const competitorChannelId = channelInfo.uploadsPlaylistId || channelInfo.channelId.replace(/^UC/, "UU");
        const competitorName = channelInfo.channelName;
        const competitorImage = channelInfo.thumbnail;

        // 2. Save to database
        const [newMonitor] = await db.insert(competitorMonitors).values({
            channelId,
            competitorChannelId,
            competitorName,
            competitorHandle: handle,
            competitorImage,
        }).returning();

        return NextResponse.json(newMonitor);
    } catch (e) {
        logger.error("Watchtower POST Error:", e);
        return NextResponse.json({ error: "Failed to add competitor" }, { status: 500 });
    }
}

// Remove a competitor monitor
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing monitor id" }, { status: 400 });

    try {
        await db.delete(competitorMonitors).where(eq(competitorMonitors.id, id));
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
