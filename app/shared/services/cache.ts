/**
 * In-Memory Cache Service
 * Provides caching layer for expensive database queries with TTL and invalidation support.
 */

import NodeCache from "node-cache";
import { log } from "./logger";

const TTL_SECONDS = 300; // 5 minutes

const cache = new NodeCache({
    stdTTL: TTL_SECONDS,
    checkperiod: 60,
    useClones: false,
});

/**
 * Retrieves cached data by key.
 */
export async function getCached<T>(key: string): Promise<T | null> {
    const value = cache.get<T>(key);
    if (value !== undefined) {
        log.debug(`[Cache] HIT: ${key}`);
        return value;
    }
    log.debug(`[Cache] MISS: ${key}`);
    return null;
}

/**
 * Stores data in cache with optional custom TTL.
 */
export async function setCached<T>(
    key: string,
    value: T,
    ttl?: number
): Promise<void> {
    cache.set(key, value, ttl ?? TTL_SECONDS);
    log.debug(`[Cache] SET: ${key}`);
}

/**
 * Invalidates a specific cache key.
 */
export function invalidate(key: string): void {
    const deleted = cache.del(key);
    if (deleted > 0) {
        log.info(`[Cache] INVALIDATE: ${key}`);
    }
}

/**
 * Invalidates all keys matching a pattern (prefix).
 */
export function invalidatePattern(pattern: string): void {
    const keys = cache.keys();
    const matching = keys.filter((key) => key.startsWith(pattern));
    if (matching.length > 0) {
        cache.del(matching);
        log.info(`[Cache] INVALIDATE_PATTERN: ${pattern} (${matching.length} keys)`);
    }
}

/**
 * Returns cache statistics for monitoring.
 */
export function getCacheStats() {
    return {
        keys: cache.keys().length,
        stats: cache.getStats(),
    };
}

