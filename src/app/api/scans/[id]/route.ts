import { auth } from "@/auth";
import { db } from "@/db";
import { scans } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { id } = await params;
        
        await db.delete(scans).where(and(eq(scans.id, id), eq(scans.userId, session.user.id)));
        
        return new NextResponse("Success", { status: 200 });
    } catch (error) {
        console.error("Failed to delete scan:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
