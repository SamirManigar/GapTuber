import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserByEmail, deleteChannel } from "@/db/queries";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        const userEmail = session?.user?.email;

        if (!userEmail) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        await deleteChannel(id, user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Delete Channel Error]", error);
        return NextResponse.json(
            { error: "Failed to delete channel" },
            { status: 500 }
        );
    }
}
