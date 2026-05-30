/**
 * YouTube OAuth2 token management.
 * Handles automatic token refresh when the access token is expired.
 *
 * Usage:
 *   const token = await getValidYouTubeToken(channelId);
 *   if (!token) // token expired and no refresh token — user must reconnect
 */

import { getChannelById, updateChannelYoutubeTokens } from "@/db/queries";
import { logger } from "@/lib/logger";
import { decryptToken, isEncrypted } from "@/lib/token-crypto";
import { env } from "@/env";

const TOKEN_REFRESH_URL = "https://oauth2.googleapis.com/token";

// Buffer: refresh the token 5 minutes before it actually expires
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export interface TokenResult {
    accessToken: string;
    /** true if a token refresh occurred — caller can log this */
    wasRefreshed: boolean;
}

/**
 * Returns a valid YouTube access token for the given GapTuber channel ID.
 * Automatically refreshes the token if it is expired or about to expire.
 *
 * @throws {Error} with message "NO_TOKEN" if the channel has no YouTube connection
 * @throws {Error} with message "REFRESH_FAILED" if the refresh token is invalid/expired
 */
export async function getValidYouTubeToken(channelId: string): Promise<TokenResult> {
    const channel = await getChannelById(channelId);

    if (!channel?.youtubeAccessToken) {
        throw new Error("NO_TOKEN");
    }

    // Decrypt stored token (backwards-compatible: legacy tokens pass through decryptToken as null,
    // in which case we use the raw value if it's NOT supposed to be encrypted)
    const rawAccess = channel.youtubeAccessToken;
    const decryptedAccess = isEncrypted(rawAccess) ? decryptToken(rawAccess) : rawAccess;
    
    // If it was supposed to be encrypted but decryption failed, we can't proceed
    if (isEncrypted(rawAccess) && !decryptedAccess) {
        logger.error(`[YouTubeTokens] Decryption failed for access token of channel ${channelId}`);
        throw new Error("REFRESH_FAILED");
    }

    const rawRefresh = channel.youtubeRefreshToken;
    let decryptedRefresh: string | null = null;
    if (rawRefresh) {
        decryptedRefresh = isEncrypted(rawRefresh) ? decryptToken(rawRefresh) : rawRefresh;
        
        if (isEncrypted(rawRefresh) && !decryptedRefresh) {
            logger.error(`[YouTubeTokens] Decryption failed for refresh token of channel ${channelId}`);
            throw new Error("REFRESH_FAILED");
        }
    }

    // Check if the token is still valid (with buffer)
    const expiresAt = channel.youtubeTokenExpiresAt;
    const isExpired = expiresAt
        ? new Date().getTime() + EXPIRY_BUFFER_MS >= expiresAt.getTime()
        : false;

    if (!isExpired && decryptedAccess) {
        return { accessToken: decryptedAccess, wasRefreshed: false };
    }

    // Token is expired — attempt refresh
    logger.info(`[YouTubeTokens] Token expired for channel ${channelId}, refreshing...`);

    if (!decryptedRefresh) {
        throw new Error("REFRESH_FAILED");
    }

    const res = await fetch(TOKEN_REFRESH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: env.AUTH_GOOGLE_ID!,
            client_secret: env.AUTH_GOOGLE_SECRET!,
            refresh_token: decryptedRefresh,
            grant_type: "refresh_token",
        }),
    });

    if (!res.ok) {
        const errorBody = await res.text();
        logger.error(`[YouTubeTokens] Refresh HTTP error: ${res.status} - ${errorBody}`);
        throw new Error("REFRESH_FAILED");
    }

    const data = await res.json() as {
        access_token?: string;
        expires_in?: number;
        error?: string;
    };

    if (!data.access_token) {
        logger.error(`[YouTubeTokens] Refresh API error: ${data.error}`);
        throw new Error("REFRESH_FAILED");
    }

    // Persist the new token
    const newExpiry = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null;

    await updateChannelYoutubeTokens(channelId, {
        accessToken: data.access_token,
        refreshToken: channel.youtubeRefreshToken, // refresh tokens don't change on OAuth2 refresh
        expiresAt: newExpiry,
    });

    logger.info(`[YouTubeTokens] Token refreshed for channel ${channelId}`);
    return { accessToken: data.access_token, wasRefreshed: true };
}

/**
 * User-friendly error messages for token errors.
 */
export function getTokenErrorMessage(error: unknown): { status: number; message: string } {
    const msg = error instanceof Error ? error.message : "Unknown";
    if (msg === "NO_TOKEN") {
        return { status: 403, message: "No YouTube connection found. Please connect your channel in Settings." };
    }
    if (msg === "REFRESH_FAILED") {
        return { status: 403, message: "YouTube session expired. Please reconnect your channel in Settings." };
    }
    return { status: 500, message: "Failed to authenticate with YouTube." };
}
