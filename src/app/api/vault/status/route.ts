import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { ideaVault, channels } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const Schema = z.object({
    channelId: z.string().uuid(),
    title: z.string().min(1),
    status: z.enum(["ready", "filming", "done"]),
});

// Map UI status → ideaVault DB enum
const STATUS_MAP: Record<string, "backlog" | "filming" | "launched"> = {
    ready:   "backlog",
    filming: "filming",
    done:    "launched",
};

export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
        }

        const { channelId, title, status } = parsed.data;

        // Verify channel ownership
        const [channel] = await db
            .select({ id: channels.id })
            .from(channels)
            .where(and(eq(channels.id, channelId), eq(channels.userId, session.user.id)))
            .limit(1);

        if (!channel) {
            return NextResponse.json({ error: "Channel not found" }, { status: 404 });
        }

        const dbStatus = STATUS_MAP[status];

        await db
            .update(ideaVault)
            .set({ status: dbStatus, updatedAt: new Date() })
            .where(and(eq(ideaVault.channelId, channelId), eq(ideaVault.title, title)));

        return NextResponse.json({ success: true, status: dbStatus });
    } catch (err) {
        console.error("[vault/status PATCH]", err);
        return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }
}
