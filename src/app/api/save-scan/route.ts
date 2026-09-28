import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scans } from "@/db/schema";
import { getChannelsByUserId } from "@/db/queries";
import type { ScanResult, ScanAnalytics } from "@/db/schema";
import { getCorsHeaders } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { resolveUserFromRequest } from "@/lib/resolve-user";
import { z } from "zod";



export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}

const SaveScanSchema = z.object({
    keyword: z.string().trim().min(1).max(200),
    channelId: z.string().uuid().optional(),
    competitors: z.array(z.string().url().max(500)).max(3).optional().default([]),
    result: z.object({
        gaps: z.array(z.unknown()).min(1).max(10),
        overallOpportunity: z.string().max(2_000).optional(),
    }).passthrough(),
    analytics: z.unknown().optional(),
    rawData: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
    const cors = getCorsHeaders(req);
    logger.debug("[SaveScan] → POST received");

    try {
        const user = await resolveUserFromRequest(req);
        if (!user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized — reload the extension after signing in to GapTuber." },
                { status: 401, headers: cors }
            );
        }

        const userChannels = await getChannelsByUserId(user.id);
        if (userChannels.length === 0) {
            return NextResponse.json(
                { success: false, error: "No channel found. Please complete GapTuber onboarding first." },
                { status: 400, headers: cors }
            );
        }

        // Use the channelId from request body if provided and valid, otherwise fall back to first
        const parsed = SaveScanSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Invalid request", details: parsed.error.flatten() },
                { status: 400, headers: cors }
            );
        }
        const body = parsed.data;

        let targetChannelId: string;
        if (body.channelId) {
            // Verify the channel belongs to this user
            const requestedChannel = userChannels.find(c => c.id === body.channelId);
            targetChannelId = requestedChannel?.id ?? userChannels[0].id;
        } else {
            targetChannelId = userChannels[0].id;
        }

        // ── Insert ──────────────────────────────────────────────────────────────────
        const [saved] = await db.insert(scans).values({
            userId: user.id,
            channelId: targetChannelId,
            keyword: body.keyword,
            competitors: body.competitors ?? [],
            rawData: body.rawData ?? {},
            result: body.result as ScanResult,
            analytics: (body.analytics ?? null) as ScanAnalytics | null,
        }).returning({ id: scans.id });

        logger.info(`[SaveScan] Saved ${saved?.id} for user ${user.id}`);
        return NextResponse.json({ success: true, id: saved?.id }, { headers: cors });

    } catch (err) {
        console.error("[SaveScan Error]", err);
        return NextResponse.json(
            { success: false, error: "Internal error" },
            { status: 500, headers: cors }
        );
    }
}
