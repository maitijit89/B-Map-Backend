import crypto from 'crypto';
import { env } from '../../core/config/env.config';
import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';
import { DirectionsQueryOptions, OsrmRouteResponse } from '../../core/types/osrm.types';

export class RouteCacheService {
  // In-memory fallback cache when Redis is disconnected
  private localFallback = new Map<string, { data: OsrmRouteResponse; expiry: number }>();

  /**
   * Generates a deterministic hash key from route query options.
   */
  public generateKey(options: DirectionsQueryOptions): string {
    const serialized = JSON.stringify({
      coords: options.coordinates.map(([lon, lat]) => [
        Math.round(lon * 10000) / 10000,
        Math.round(lat * 10000) / 10000,
      ]),
      profile: options.profile || 'driving',
      steps: options.steps ?? true,
      alternatives: options.alternatives ?? false,
      overview: options.overview ?? 'full',
    });

    const hash = crypto.createHash('sha256').update(serialized).digest('hex');
    return `route:${hash}`;
  }

  /**
   * Retrieves cached OSRM route response.
   */
  async get(key: string): Promise<OsrmRouteResponse | null> {
    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        const cached = await redis.get(key);
        if (cached) {
          logger.debug(`[Cache Hit] Redis key: ${key}`);
          return JSON.parse(cached) as OsrmRouteResponse;
        }
      } else {
        // Fallback check
        const item = this.localFallback.get(key);
        if (item && item.expiry > Date.now()) {
          logger.debug(`[Cache Hit] In-memory key: ${key}`);
          return item.data;
        }
      }
    } catch (err: any) {
      logger.warn(`Failed reading route cache (${key}): ${err.message}`);
    }

    return null;
  }

  /**
   * Caches OSRM route response with configured TTL.
   */
  async set(
    key: string,
    data: OsrmRouteResponse,
    ttlSeconds: number = env.REDIS_ROUTE_CACHE_TTL_SECONDS
  ): Promise<void> {
    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
        logger.debug(`[Cache Set] Redis key: ${key} (TTL: ${ttlSeconds}s)`);
      } else {
        // Fallback store
        this.localFallback.set(key, {
          data,
          expiry: Date.now() + ttlSeconds * 1000,
        });

        // Prune old fallback items
        if (this.localFallback.size > 500) {
          const now = Date.now();
          for (const [k, v] of this.localFallback.entries()) {
            if (v.expiry < now) this.localFallback.delete(k);
          }
        }
      }
    } catch (err: any) {
      logger.warn(`Failed storing route cache (${key}): ${err.message}`);
    }
  }

  /**
   * Clears route cache key.
   */
  async invalidate(key: string): Promise<void> {
    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        await redis.del(key);
      }
      this.localFallback.delete(key);
    } catch (err: any) {
      logger.warn(`Failed invalidating route cache (${key}): ${err.message}`);
    }
  }
}

export const routeCacheService = new RouteCacheService();
