import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(req: NextRequest) {
    try {
        // ── 1. Auth check ─────────────────────────────────────────────────────
        const session = await auth();
        if (!session?.user?.id || !session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const userId = session.user.id;

        // ── 2. Confirm the request body contains the user's own email ──────────
        // This acts as a second-factor confirmation (user must type their email)
        let body: { confirmEmail?: string };
        try {
            body = await req.json();
        } catch {
            return new NextResponse("Invalid request body", { status: 400 });
        }

        if (!body.confirmEmail || body.confirmEmail.toLowerCase().trim() !== session.user.email.toLowerCase()) {
            return new NextResponse("Email confirmation does not match your account", { status: 400 });
        }

        // ── 3. Delete user — all child tables cascade via FK constraints ───────
        // schema.ts uses onDelete: "cascade" on all child tables:
        // channels → scans, botChats → botMessages, competitorMonitors → insights, ideaVault
        await db.delete(users).where(eq(users.id, userId));

        console.log(`[ACCOUNT_DELETE] User ${userId} (${session.user.email}) account deleted.`);

        return NextResponse.json({ deleted: true });

    } catch (err) {
        console.error("[ACCOUNT_DELETE_ERROR]", err);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
