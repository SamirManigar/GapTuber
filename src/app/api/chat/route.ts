import { auth } from "@/auth";
import { 
    getBotChatsByUserId, 
    createBotChat, 
    deleteBotChat 
} from "@/db/queries";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const channelId = searchParams.get("channelId");

        const chats = await getBotChatsByUserId(session.user.id, channelId || undefined);
        return NextResponse.json(chats);
    } catch (error) {
        console.error("Failed to fetch chats:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { title, channelId } = await req.json();
        const chat = await createBotChat(session.user.id, title, channelId);
        
        return NextResponse.json(chat);
    } catch (error) {
        console.error("Failed to create chat:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { id } = await req.json();
        if (!id) return new NextResponse("Chat ID required", { status: 400 });

        await deleteBotChat(id);
        
        return new NextResponse("Success", { status: 200 });
    } catch (error) {
        console.error("Failed to delete chat:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
