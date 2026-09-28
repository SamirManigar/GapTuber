import { auth } from "@/auth";
import { getBotMessagesByChatId } from "@/db/queries";
import { NextResponse } from "next/server";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        
        const { chatId } = await params;

        if (!chatId) {
            return new NextResponse("Chat ID required", { status: 400 });
        }

        const messages = await getBotMessagesByChatId(chatId);
        return NextResponse.json(messages);
    } catch (error) {
        console.error("Failed to fetch messages:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
