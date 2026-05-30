import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getChannelById, updateChannelBlueprint, getUserByEmail } from "@/db/queries";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { channelId, videoIdeas, videoIdeaStatus } = await req.json();

        if (!channelId || !videoIdeas) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        const channel = await getChannelById(channelId);
        const dbUser = await getUserByEmail(session.user.email);
        
        if (!channel || !dbUser || channel.userId !== dbUser.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        await updateChannelBlueprint(channelId, { 
            videoIdeas, 
            videoIdeaStatus: videoIdeaStatus ?? {} 
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
