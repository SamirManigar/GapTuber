/**
 * Rate limiter using Upstash Redis with a fallback to in-memory sliding window.
 * 
 * Works in both Node.js and Edge runtimes. In-memory fallback is limited to Node.js.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/env";
import { logger } from "./logger";

// ─── In-Memory Fallback Implementation ───────────────────────────────────────
interface RateLimitEntry {
    timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();


export interface RateLimitResult {
    /** Whether the request is within the rate limit */
    allowed: boolean;
    /** Requests remaining in the current window */
    remaining: number;
    /** Milliseconds until the window resets */
    resetMs: number;
}

function inMemoryRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
    const now = Date.now();

    // Passive cleanup to avoid memory leak
    if (Math.random() < 0.1) {
        for (const [k, entry] of store.entries()) {
            if (entry.timestamps.length === 0 || entry.timestamps.every(t => now - t > windowMs)) {
                store.delete(k);
            }
        }
    }

    const entry = store.get(key) ?? { timestamps: [] };

    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

    const remaining = Math.max(0, max - entry.timestamps.length);
    const oldest = entry.timestamps[0] ?? now;
    const resetMs = Math.max(0, windowMs - (now - oldest));

    if (entry.timestamps.length >= max) {
        store.set(key, entry);
        return { allowed: false, remaining: 0, resetMs };
    }

    entry.timestamps.push(now);
    store.set(key, entry);
    return { allowed: true, remaining: remaining - 1, resetMs };
}

// ─── Redis Implementation ─────────────────────────────────────────────────────

// Initialize Redis only if env variables are present
const redisUrl = env.UPSTASH_REDIS_REST_URL;
const redisToken = env.UPSTASH_REDIS_REST_TOKEN;

const redisClient = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

// Cache of ratelimiters so we don't recreate them every time
const rateLimiters = new Map<string, Ratelimit>();

function getRedisLimiter(max: number, windowMs: number): Ratelimit {
    const limiterKey = `${max}:${windowMs}`;
    if (rateLimiters.has(limiterKey)) {
        return rateLimiters.get(limiterKey)!;
    }
    
    const windowSeconds = Math.max(1, Math.floor(windowMs / 1000));
    
    const limiter = new Ratelimit({
        redis: redisClient!,
        limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
        analytics: true,
        // Optional prefix
        prefix: "@upstash/ratelimit",
    });
    
    rateLimiters.set(limiterKey, limiter);
    return limiter;
}

/**
 * @param key       Unique identifier (e.g. "ai:userId", "scan:ip")
 * @param max       Max requests allowed per window
 * @param windowMs  Window size in milliseconds (e.g. 60_000 for 1 minute)
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
    if (!redisClient) {
        // Fallback to in-memory if Redis is not configured
        return inMemoryRateLimit(key, max, windowMs);
    }
    
    try {
        const limiter = getRedisLimiter(max, windowMs);
        const { success, limit, remaining, reset } = await limiter.limit(key);
        
        return {
            allowed: success,
            remaining,
            resetMs: Math.max(0, reset - Date.now())
        };
    } catch (e) {
        logger.error("[RateLimit] Redis error — failing open:", e);
        return { allowed: true, remaining: 1, resetMs: 0 };
    }
}

/**
 * Rate limit configs for each AI endpoint.
 * Adjust max/windowMs to match your Groq plan.
 *
 * Production values below. For local dev, temporarily increase as needed.
 * TODO: Implement per-tier limits (free vs pro) via middleware that reads user.tier.
 */
export const RATE_LIMITS = {
    /** Heavy: full market analysis + AI — 30 per hour */
    channelCreation: { max: 30, windowMs: 60 * 60_000 },
    /** Medium: gap scanner — 30 per hour */
    gapScanner: { max: 30, windowMs: 60 * 60_000 },
    /** Medium: channel analyze — 30 per hour */
    channelAnalyze: { max: 30, windowMs: 60 * 60_000 },
    /** Light: generate ideas — 50 per hour */
    generateIdeas: { max: 50, windowMs: 60 * 60_000 },
    /** Chat: aurabot — 100 per hour */
    aurabot: { max: 100, windowMs: 60 * 60_000 },
    /** Heavy: deep web research + AI — 20 per hour */
    webAnalyze: { max: 20, windowMs: 60 * 60_000 },
    /** Extension: real-time analysis — 100 per hour */
    analyze: { max: 100, windowMs: 60 * 60_000 },
    /** Light: competitor suggestions — 30 per hour */
    recommendCompetitors: { max: 30, windowMs: 60 * 60_000 },
} as const;
