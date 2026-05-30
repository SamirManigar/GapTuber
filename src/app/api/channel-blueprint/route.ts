import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserByEmail, updateChannelBlueprint, deductUserCredits } from "@/db/queries";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await getUserByEmail(session.user.email);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const body = await req.json();
        const { channelId, videoIdeas, contentStrategy, marketSnapshot } = body;

        if (!channelId) {
            return NextResponse.json({ error: "channelId required" }, { status: 400 });
        }

        if (user.credits < 1) {
            return NextResponse.json({ error: "Insufficient credits. You need 1 credit to generate ideas." }, { status: 402 });
        }

        const updated = await updateChannelBlueprint(channelId, {
            contentStrategy,
            marketSnapshot,
        });

        // Deduct credit
        await deductUserCredits(user.id, 1, "Idea Generation");

        return NextResponse.json({ success: true, channel: updated });
    } catch (error) {
        logger.error("[channel-blueprint] Error:", error);
        return NextResponse.json({ error: "Failed to update blueprint" }, { status: 500 });
    }
}
