import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "./index";
import { scans, users, channels, botChats, botMessages, creditHistory, type NewScan, type NewChannel, type NewBotMessage, type VideoIdeaDB } from "./schema";

import { encryptToken } from "@/lib/token-crypto";
import { logger } from "@/lib/logger";

export async function upsertUser(email: string, name?: string, image?: string) {
    const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (existing.length > 0) return existing[0];

    const [user] = await db
        .insert(users)
        .values({ email, name, image })
        .returning();

    return user;
}

export async function createChannel(data: NewChannel) {
    const [channel] = await db.insert(channels).values(data).returning();
    return channel;
}

export async function getChannelsByUserId(userId: string) {
    return db
        .select()
        .from(channels)
        .where(eq(channels.userId, userId))
        .orderBy(channels.createdAt);
}

export async function getChannelById(id: string) {
    const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, id))
        .limit(1);
    return channel ?? null;
}

export async function deleteChannel(id: string, userId: string) {
    return db
        .delete(channels)
        .where(and(eq(channels.id, id), eq(channels.userId, userId)));
}

export async function createScan(data: NewScan) {
    const [scan] = await db.insert(scans).values(data).returning();
    return scan;
}

export async function getChannelScans(channelId: string, limit = 20, offset = 0) {
    return db
        .select()
        .from(scans)
        .where(eq(scans.channelId, channelId))
        .orderBy(desc(scans.createdAt))
        .limit(limit)
        .offset(offset);
}

export async function getScanById(id: string) {
    const [scan] = await db.select().from(scans).where(eq(scans.id, id)).limit(1);
    return scan ?? null;
}

export async function getUserByEmail(email: string) {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
    return user ?? null;
}

export async function deductUserCredits(userId: string, amount: number, action: string) {
    const [updated] = await db
        .update(users)
        .set({ credits: sql`${users.credits} - ${amount}` })
        .where(eq(users.id, userId))
        .returning();

    // Log the transaction
    await db.insert(creditHistory).values({
        userId,
        amount: -amount,
        action,
    });

    return updated;
}

export async function getUserCreditHistory(userId: string, limit = 20) {
    return db
        .select()
        .from(creditHistory)
        .where(eq(creditHistory.userId, userId))
        .orderBy(desc(creditHistory.createdAt))
        .limit(limit);
}

export async function getUserById(id: string) {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
    return user ?? null;
}

export async function updateChannelYoutubeTokens(
    channelId: string,
    tokens: {
        accessToken: string;
        refreshToken?: string | null;
        expiresAt?: Date | null;
        youtubeChannelId?: string | null;
    }
) {
    // Encrypt sensitive OAuth tokens before persisting
    const encryptedAccess = encryptToken(tokens.accessToken);
    const encryptedRefresh = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;

    return db
        .update(channels)
        .set({
            youtubeAccessToken: encryptedAccess,
            youtubeRefreshToken: encryptedRefresh,
            youtubeTokenExpiresAt: tokens.expiresAt ?? null,
            youtubeChannelId: tokens.youtubeChannelId ?? null,
        })
        .where(eq(channels.id, channelId));
}

export async function updateChannelBlueprint(
    channelId: string,
    data: {
        contentStrategy?: string;
        marketSnapshot?: Record<string, unknown>;
        videoIdeaStatus?: Record<string, string>;
    }
) {
    // When writing videoIdeaStatus, merge into existing brandingData instead of
    // overwriting it — preserves other keys like `theme`, `brandDescription`, etc.
    let brandingUpdate: Record<string, unknown> | undefined;
    if (data.videoIdeaStatus !== undefined) {
        const [existing] = await db
            .select({ brandingData: channels.brandingData })
            .from(channels)
            .where(eq(channels.id, channelId))
            .limit(1);
        const existingBranding = (existing?.brandingData as Record<string, unknown> | null) ?? {};
        brandingUpdate = { ...existingBranding, videoIdeaStatus: data.videoIdeaStatus };
    }

    const setClause = {
        ...(data.contentStrategy !== undefined ? { contentStrategy: data.contentStrategy } : {}),
        ...(data.marketSnapshot !== undefined ? { marketSnapshot: data.marketSnapshot } : {}),
        ...(brandingUpdate !== undefined ? { brandingData: brandingUpdate } : {}),
    };

    // Guard: skip the query if there's nothing to update (avoids empty SET clause error)
    if (Object.keys(setClause).length === 0) return null;

    const [updated] = await db
        .update(channels)
        .set(setClause)
        .where(eq(channels.id, channelId))
        .returning();
    return updated;
}

/** Persists a single video idea's status toggle (done/filming/ready) */
export async function updateVideoIdeaStatus(
    channelId: string,
    ideaIndex: number,
    status: "ready" | "filming" | "done",
    isVaultMode: boolean = false
) {
    // Fetch current channel to merge status map
    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel) return;

    const existing = (channel.brandingData as { videoIdeaStatus?: Record<string, string>; savedIdeaStatus?: Record<string, string>; [key: string]: unknown } | null) ?? {};
    
    const targetKey = isVaultMode ? "savedIdeaStatus" : "videoIdeaStatus";
    const statusMap: Record<string, string> = {
        ...(existing[targetKey] ?? {}),
        [String(ideaIndex)]: status,
    };

    await db.update(channels).set({
        brandingData: { ...existing, [targetKey]: statusMap }
    }).where(eq(channels.id, channelId));
}

// ─── AuraBot Queries ─────────────────────────────────────────────────────────

export async function createBotChat(userId: string, title?: string, channelId?: string) {
    const [chat] = await db
        .insert(botChats)
        .values({ userId, channelId: channelId || null, title: title || "New Chat" })
        .returning();
    return chat;
}

export async function getBotChatsByUserId(userId: string, channelId?: string) {
    let query = db
        .select()
        .from(botChats)
        .where(eq(botChats.userId, userId))
        .$dynamic();

    if (channelId) {
        query = query.where(and(eq(botChats.userId, userId), eq(botChats.channelId, channelId)));
    } else {
        // If we want backwards compatibility for chats without channelId, we might not filter.
        // But let's just return all for this user if channelId is not provided, or filter strictly.
    }

    return query.orderBy(desc(botChats.updatedAt));
}

export async function getBotChatById(id: string) {
    const [chat] = await db
        .select()
        .from(botChats)
        .where(eq(botChats.id, id))
        .limit(1);
    return chat ?? null;
}

export async function deleteBotChat(id: string) {
    const [chat] = await db
        .delete(botChats)
        .where(eq(botChats.id, id))
        .returning();
    return chat;
}

export async function createBotMessage(data: NewBotMessage) {
    // Update the chat's updatedAt timestamp
    await db
        .update(botChats)
        .set({ updatedAt: new Date() })
        .where(eq(botChats.id, data.chatId));

    const [message] = await db
        .insert(botMessages)
        .values(data)
        .returning();
    return message;
}

export async function getBotMessagesByChatId(chatId: string) {
    return db
        .select()
        .from(botMessages)
        .where(eq(botMessages.chatId, chatId))
        .orderBy(botMessages.createdAt);
}
