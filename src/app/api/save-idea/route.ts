import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ideaVault, scans } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getChannelsByUserId } from "@/db/queries";
import { getCorsHeaders } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { resolveUserFromRequest } from "@/lib/resolve-user";
import { z } from "zod";

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}

const SaveIdeaSchema = z.object({
    channelId: z.string().uuid().optional(),
    ideas: z.array(z.object({
        title: z.string().trim().min(1).max(200),
        hook: z.string().max(2_000).optional(),
        format: z.string().max(200).optional(),
        targetAudience: z.string().max(1_000).optional(),
        signalSource: z.string().max(200).optional(),
        tags: z.array(z.string().max(100)).max(30).optional(),
        scanId: z.string().uuid().optional(),
        gapId: z.string().uuid().optional(),
        estimatedViewPotential: z.enum(["high", "medium", "low"]).optional(),
        whyItWorks: z.string().max(5_000).optional(),
        script: z.string().max(100_000).optional(),
        description: z.string().max(10_000).optional(),
    })).min(1).max(20),
});

/**
 * POST /api/save-idea
 * Saves a single video idea from the extension to the user's channel vault (savedIdeas).
 * Supports both cookie-based auth (direct browser) and X-Session-Cookie header (extension).
 */
export async function POST(req: NextRequest) {
    const cors = getCorsHeaders(req);
    logger.debug("[SaveIdea] → POST received");

    try {
        const user = await resolveUserFromRequest(req);
        if (!user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401, headers: cors }
            );
        }

        const userChannels = await getChannelsByUserId(user.id);
        if (userChannels.length === 0) {
            return NextResponse.json(
                { success: false, error: "No channel found. Complete onboarding first." },
                { status: 400, headers: cors }
            );
        }

        const parsed = SaveIdeaSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Invalid request", details: parsed.error.flatten() },
                { status: 400, headers: cors }
            );
        }
        const body = parsed.data;

        // Resolve target channel (body.channelId → first channel)
        const targetChannel = body.channelId
            ? userChannels.find(c => c.id === body.channelId) ?? userChannels[0]
            : userChannels[0];

        // Insert into ideaVault
        const inserts = [];

        for (const idea of body.ideas) {
            let source = "manual";
            if (idea.signalSource) {
                if (idea.signalSource.includes("watchtower")) source = "watchtower";
                else if (idea.signalSource.includes("extension")) source = "extension";
                else if (idea.signalSource.includes("ai_studio")) source = "ai_studio";
                else if (idea.signalSource.includes("gapscan")) source = "gapscan";
            }
            
            let frozenData: any = {};

            if (idea.scanId && idea.gapId) {
                // Securely fetch from DB
                const scanRecord = await db.query.scans.findFirst({
                    where: and(
                        eq(scans.id, idea.scanId),
                        eq(scans.userId, user.id) // Ensure scan belongs to user
                    )
                });

                if (scanRecord && scanRecord.result && (scanRecord.result as any).gaps) {
                    const originalGap = (scanRecord.result as any).gaps.find((g: any) => g.id === idea.gapId);
                    if (originalGap) {
                        frozenData = {
                            opportunityScoreAtRecommendation: originalGap.gapScore,
                            confidenceAtRecommendation: originalGap.confidence,
                            recommendationSignals: {
                                quantitativeReasons: originalGap.quantitativeReasons,
                                overallOpportunity: (scanRecord.result as any).overallOpportunity,
                                commentInsights: (scanRecord.rawData as any)?.commentInsights
                            },
                            recommendedAt: new Date(),
                            scoringVersion: "v1.3" // Snapshot version
                        };
                    } else {
                        logger.warn(`Gap ID ${idea.gapId} not found in scan ${idea.scanId}`);
                    }
                } else {
                    logger.warn(`Scan ID ${idea.scanId} not found or no result for user ${user.id}`);
                }
            }

            inserts.push({
                channelId: targetChannel.id,
                title: idea.title || "Untitled Idea",
                hook: idea.hook,
                format: idea.format,
                targetAudience: idea.targetAudience,
                status: "backlog" as const,
                estimatedViewPotential: (idea.estimatedViewPotential || "medium") as "high" | "medium" | "low",
                source: source as any,
                whyItWorks: idea.whyItWorks,
                script: idea.script,
                description: idea.description,
                tags: idea.tags || [],
                ...frozenData
            });
        }

        await db.insert(ideaVault).values(inserts);

        logger.info(`[SaveIdea] Added ${inserts.length} idea(s) for user ${user.id}`);
        return NextResponse.json(
            { success: true, added: inserts.length, channelId: targetChannel.id },
            { headers: cors }
        );

    } catch (err) {
        logger.error("[SaveIdea Error]", err);
        return NextResponse.json(
            { success: false, error: "Internal error" },
            { status: 500, headers: cors }
        );
    }
}
