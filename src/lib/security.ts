import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Timing-Safe Comparison ────────────────────────────────────────────────────
// Prevents timing attacks where an attacker can guess the secret
// byte-by-byte by measuring response time differences.
export function safeCompare(a: string, b: string): boolean {
    try {
        const aBuf = Buffer.from(a, "hex");
        const bBuf = Buffer.from(b, "hex");
        // timingSafeEqual requires equal-length buffers — pad or reject if different
        if (aBuf.length !== bBuf.length) return false;
        return crypto.timingSafeEqual(aBuf, bBuf);
    } catch {
        return false;
    }
}

// ─── Webhook Idempotency ───────────────────────────────────────────────────────
// Prevents replay attacks where an attacker re-sends a captured webhook
// to duplicate credit grants. Each unique event ID is stored for 7 days.
const IDEMPOTENCY_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

export async function isAlreadyProcessed(eventId: string): Promise<boolean> {
    const key = `webhook:processed:${eventId}`;
    const existing = await redis.get(key);
    return existing !== null;
}

export async function markAsProcessed(eventId: string): Promise<void> {
    const key = `webhook:processed:${eventId}`;
    await redis.set(key, "1", { ex: IDEMPOTENCY_TTL });
}

// ─── Payment Rate Limiting ─────────────────────────────────────────────────────
// Prevents brute-force and double-click double-charging on checkout endpoints.
// Limits each user to MAX_REQUESTS per WINDOW_SECONDS.
const MAX_REQUESTS = 3;
const WINDOW_SECONDS = 60;

export async function withPaymentRateLimit(userId: string): Promise<boolean> {
    const key = `ratelimit:payment:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) {
        // First request — set the TTL on the key
        await redis.expire(key, WINDOW_SECONDS);
    }
    return count <= MAX_REQUESTS; // Returns true if ALLOWED, false if BLOCKED
}

// ─── Razorpay Order Idempotency ────────────────────────────────────────────────
// Prevents double-orders from double-clicks. Stores the last created orderId
// per user for 60 seconds. If same user requests within that window, 
// return the cached order instead of creating a new one.
const ORDER_CACHE_TTL = 60; // seconds

export async function getCachedOrder(userId: string, plan: string): Promise<string | null> {
    return redis.get<string>(`order:cache:${userId}:${plan}`);
}

export async function cacheOrder(userId: string, plan: string, orderId: string): Promise<void> {
    await redis.set(`order:cache:${userId}:${plan}`, orderId, { ex: ORDER_CACHE_TTL });
}
