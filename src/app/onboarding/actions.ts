"use server";

import { auth } from "@/auth";
import { createChannel, getUserByEmail, updateChannelBlueprint, getChannelsByUserId } from "@/db/queries";
import { redirect } from "next/navigation";

export async function completeNewTuberOnboarding(formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const dbUser = await getUserByEmail(session.user.email);
    if (!dbUser) throw new Error("User not found in database.");

    const existingChannels = await getChannelsByUserId(dbUser.id);
    if (existingChannels.length >= 5) {
        throw new Error("You have reached the maximum limit of 5 projects.");
    }

    const category = formData.get("category") as string;
    const topic = formData.get("topic") as string;
    const theme = formData.get("theme") as string;
    const channelName = formData.get("channelName") as string;
    const videoIdeasRaw = formData.get("videoIdeas") as string;
    const contentStrategy = formData.get("contentStrategy") as string;
    const marketSnapshotRaw = formData.get("marketSnapshot") as string;

    // Branding data
    const brandingData = {
        theme,
        aiGenerated: true,
    };

    const channel = await createChannel({
        userId: dbUser.id,
        name: channelName || `${topic || "My Channel"}`,
        role: "new_tuber",
        category,
        topic,
        brandingData
    });

    // Persist blueprint data (video ideas, strategy, market data)
    if (channel) {
        try {
            const videoIdeas = videoIdeasRaw ? JSON.parse(videoIdeasRaw) : [];
            const marketSnapshot = marketSnapshotRaw ? JSON.parse(marketSnapshotRaw) : {};

            await updateChannelBlueprint(channel.id, {
                videoIdeas,
                contentStrategy: contentStrategy || undefined,
                marketSnapshot,
            });
        } catch (err) {
            console.error("[Onboarding] Failed to persist blueprint data:", err);
            // Non-blocking: channel is created even if blueprint save fails
        }
    }

    redirect("/dashboard");
}


export async function completeExistingTuberOnboarding(formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const dbUser = await getUserByEmail(session.user.email);
    if (!dbUser) throw new Error("User not found in database.");

    const existingChannels = await getChannelsByUserId(dbUser.id);
    if (existingChannels.length >= 5) {
        throw new Error("You have reached the maximum limit of 5 projects.");
    }

    const channelUrl = formData.get("channelUrl") as string;
    const youtubeChannelId = formData.get("youtubeChannelId") as string | null;
    const channelName = formData.get("channelName") as string | null;
    const category = formData.get("category") as string | null;

    // Use real channel name if provided by analysis, else fall back to handle extraction
    const name = channelName?.trim()
        || channelUrl.split("/").pop()?.replace(/^@/, "")
        || "Existing Channel";

    await createChannel({
        userId: dbUser.id,
        name,
        role: "existing_tuber",
        category: category || undefined,
        youtubeChannelId: youtubeChannelId || channelUrl,
    });

    redirect("/dashboard");
}

