import { Redis } from "@upstash/redis";
import { logger } from "./logger";
import { env } from "@/env";

const redisUrl = env.UPSTASH_REDIS_REST_URL;
const redisToken = env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

/**
 * Caches the result of a generic async function in Redis.
 * @param key The unique cache key.
 * @param fetcher The async function to run if there's a cache miss.
 * @param ttlSeconds Time to live in seconds (default 1 hour).
 */
export async function cacheData<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = 3600): Promise<T> {
    if (!redis) {
        // If Redis is not configured, just run the fetcher
        return fetcher();
    }

    try {
        const cached = await redis.get<T>(key);
        if (cached) {
            logger.debug(`[Cache Hit] ${key}`);
            return cached;
        }

        logger.debug(`[Cache Miss] ${key}`);
        const freshData = await fetcher();

        if (freshData && (!Array.isArray(freshData) || freshData.length > 0)) {
            // Background caching, don't await so we can return quickly
            redis.set(key, freshData, { ex: ttlSeconds }).catch((e) => {
                logger.error(`[Cache Set Error] ${key}:`, e);
            });
        }
        
        return freshData;
    } catch (error) {
        logger.error(`[Cache Error] ${key}:`, error);
        // Fallback to fetcher if Redis fails
        return fetcher();
    }
}
