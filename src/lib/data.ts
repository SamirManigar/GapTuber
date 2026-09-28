/**
 * Shared server-side data fetching with Next.js request deduplication.
 * Uses React's cache() to ensure getUserByEmail / getChannelsByUserId
 * are called ONCE per request regardless of how many server components
 * invoke them (layout + page no longer hit the DB twice).
 */

import { cache } from "react";
import { getUserByEmail, getChannelsByUserId, getChannelScans } from "@/db/queries";
import type { Channel, User } from "@/db/schema";

export const getCachedUser = cache(async (email: string): Promise<User | null> => {
    return getUserByEmail(email);
});

export const getCachedChannels = cache(async (userId: string): Promise<Channel[]> => {
    return getChannelsByUserId(userId);
});

export const getCachedScans = cache(async (channelId: string, limit = 20) => {
    return getChannelScans(channelId, limit);
});
