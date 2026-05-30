import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { ideaVault } from "@/db/schema";
import { getUserByEmail, getChannelsByUserId, updateChannelBlueprint } from "@/db/queries";
import { getCorsHeaders } from "@/lib/cors";
import { logger } from "@/lib/logger";
import type { VideoIdeaDB } from "@/db/schema";

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}

/**
 * POST /api/save-idea
 * Saves a single video idea from the extension to the user's channel vault (savedIdeas).
 * Supports both cookie-based auth (direct browser) and X-Session-Cookie header (extension).
 */
export async function POST(req: NextRequest) {
    const cors = getCorsHeaders(req);
    logger.debug("[SaveIdea] → POST received");

    try {
        let userEmail: string | null = null;

        // ── Step 1: Try standard session auth ──────────────────────────────────
        try {
            const session = await auth();
            userEmail = session?.user?.email ?? null;
        } catch (e) {
            logger.debug("[SaveIdea] Step1 auth() threw:", String(e).slice(0, 100));
        }

        // ── Step 2: Try X-Session-Cookie header (extension fallback) ───────────
        if (!userEmail) {
            const cookieValue = req.headers.get("X-Session-Cookie");
            if (cookieValue) {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
                const cookieNames = ["authjs.session-token", "__Secure-authjs.session-token"];
                for (const name of cookieNames) {
                    try {
                        const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
                            headers: { Cookie: `${name}=${cookieValue}` },
                        });
                        const sessionData = await sessionRes.json() as { user?: { email?: string } };
                        if (sessionData?.user?.email) {
                            userEmail = sessionData.user.email;
                            break;
                        }
                    } catch { /* non-critical */ }
                }
            }
        }

        if (!userEmail) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401, headers: cors }
            );
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404, headers: cors }
            );
        }

        const userChannels = await getChannelsByUserId(user.id);
        if (userChannels.length === 0) {
            return NextResponse.json(
                { success: false, error: "No channel found. Complete onboarding first." },
                { status: 400, headers: cors }
            );
        }

        const body = await req.json() as {
            channelId?: string;
            ideas: VideoIdeaDB[];
        };

        if (!body.ideas?.length) {
            return NextResponse.json(
                { success: false, error: "ideas array is required" },
                { status: 400, headers: cors }
            );
        }

        // Resolve target channel (body.channelId → first channel)
        const targetChannel = body.channelId
            ? userChannels.find(c => c.id === body.channelId) ?? userChannels[0]
            : userChannels[0];

        // Insert into ideaVault
        const inserts = body.ideas.map(idea => {
            let source = "manual";
            if (idea.signalSource) {
                if (idea.signalSource.includes("watchtower")) source = "watchtower";
                else if (idea.signalSource.includes("extension")) source = "extension";
                else if (idea.signalSource.includes("ai_studio")) source = "ai_studio";
                else if (idea.signalSource.includes("gapscan")) source = "gapscan";
            }
            
            return {
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
            };
        });

        await db.insert(ideaVault).values(inserts);

        logger.info(`[SaveIdea] ✅ +${inserts.length} idea(s) for ${userEmail} → channel ${targetChannel.id}`);
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
