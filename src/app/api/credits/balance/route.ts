import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserByEmail } from "@/db/queries";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ credits: user.credits });
}
