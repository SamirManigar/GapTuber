import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getChannelById } from "@/db/queries";
import { updateVideoIdeaStatus } from "@/db/queries";
import { z } from "zod";

const Schema = z.object({
    channelId: z.string().uuid(),
    ideaIndex: z.number().int().min(0).max(50),
    status: z.enum(["ready", "filming", "done"]),
    isVaultMode: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        const { channelId, ideaIndex, status, isVaultMode } = parsed.data;

        // Verify ownership
        const channel = await getChannelById(channelId);
        if (!channel || channel.userId !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        await updateVideoIdeaStatus(channelId, ideaIndex, status, isVaultMode);
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }
}
