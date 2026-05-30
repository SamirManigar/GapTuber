import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { ideaVault } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getChannelById } from "@/db/queries";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const channel = await getChannelById(id);
        if (!channel || channel.userId !== session.user.id) {
            return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
        }

        const body = await req.json();

        if (body.attachToIdeaTitle) {
            const existingIdea = await db.query.ideaVault.findFirst({
                where: (iv, { eq, and }) => and(eq(iv.channelId, id), eq(iv.title, body.attachToIdeaTitle))
            });

            if (!existingIdea) {
                return NextResponse.json({ error: "idea not save in vault" }, { status: 400 });
            }

            await db.update(ideaVault).set({ script: body.script, status: "scripting" }).where(eq(ideaVault.id, existingIdea.id));
            return NextResponse.json({ success: true, message: "Script attached to existing idea in vault" });
        }

        const inserts = [{
            channelId: id,
            title: body.title || "Untitled Idea",
            hook: body.hook || "",
            format: body.format || "video",
            targetAudience: body.targetAudience || "",
            status: "backlog" as const,
            estimatedViewPotential: (body.estimatedViewPotential || "medium") as "high" | "medium" | "low",
            source: "ai_studio" as const,
            whyItWorks: body.whyItWorks || body.reasoning || "",
            script: body.script || "",
        }];

        await db.insert(ideaVault).values(inserts);

        return NextResponse.json({ success: true, idea: inserts[0] });
    } catch (error) {
        console.error("[Add Idea Error]", error);
        return NextResponse.json(
            { error: "Failed to add idea" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const channel = await getChannelById(id);
        if (!channel || channel.userId !== session.user.id) {
            return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
        }

        const url = new URL(req.url);
        const titleToDelete = url.searchParams.get("title");

        if (!titleToDelete) {
            return NextResponse.json({ error: "Title parameter is required" }, { status: 400 });
        }

        await db.delete(ideaVault).where(and(eq(ideaVault.channelId, id), eq(ideaVault.title, titleToDelete)));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Delete Idea Error]", error);
        return NextResponse.json(
            { error: "Failed to delete idea" },
            { status: 500 }
        );
    }
}
