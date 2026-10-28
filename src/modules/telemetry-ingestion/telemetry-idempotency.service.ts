import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';
import { TelemetryEvent } from './telemetry.types';

export class TelemetryIdempotencyService {
  // 24-hour default TTL for idempotency deduplication window
  private readonly DEFAULT_TTL_SECONDS = 86400;

  // In-memory LRU fallback cache for when Redis is unavailable
  private memoryCache = new Map<string, number>();
  private readonly MAX_MEMORY_CACHE_SIZE = 100000;

  /**
   * Checks whether an eventId has already been seen.
   * If new, atomically marks it as seen with TTL.
   * Returns true if event is unique/new, false if duplicate.
   */
  public async checkAndSetEventIdempotent(
    eventId: string,
    ttlSeconds: number = this.DEFAULT_TTL_SECONDS
  ): Promise<boolean> {
    const key = `telemetry:idempotency:event:${eventId}`;

    if (isRedisConnected()) {
      try {
        const client = getRedisClient();
        // Redis SET key 1 NX EX ttl: Returns 'OK' if key did not exist, null if key exists
        const result = await client.set(key, '1', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      } catch (err: any) {
        logger.warn(`Redis idempotency error (${err.message}). Falling back to memory cache.`);
      }
    }

    // In-memory fallback
    const now = Date.now();
    this.cleanExpiredMemoryKeys(now);

    const existingExpiry = this.memoryCache.get(key);
    if (existingExpiry && existingExpiry > now) {
      return false; // Duplicate
    }

    // Enforce cache cap
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }

    this.memoryCache.set(key, now + ttlSeconds * 1000);
    return true;
  }

  /**
   * Checks whether a batchId has already been consumed.
   */
  public async checkAndSetBatchIdempotent(
    batchId: string,
    ttlSeconds: number = this.DEFAULT_TTL_SECONDS
  ): Promise<boolean> {
    const key = `telemetry:idempotency:batch:${batchId}`;

    if (isRedisConnected()) {
      try {
        const client = getRedisClient();
        const result = await client.set(key, '1', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      } catch (err: any) {
        logger.warn(`Redis batch idempotency error (${err.message}). Falling back to memory.`);
      }
    }

    const now = Date.now();
    this.cleanExpiredMemoryKeys(now);

    const existingExpiry = this.memoryCache.get(key);
    if (existingExpiry && existingExpiry > now) {
      return false;
    }

    this.memoryCache.set(key, now + ttlSeconds * 1000);
    return true;
  }

  /**
   * Deduplicates an array of incoming telemetry events in a single batch pass.
   * Strips out duplicates while preserving newly seen events.
   */
  public async filterNewEvents(events: TelemetryEvent[]): Promise<{
    newEvents: TelemetryEvent[];
    duplicatesCount: number;
  }> {
    const newEvents: TelemetryEvent[] = [];
    let duplicatesCount = 0;

    for (const event of events) {
      const isNew = await this.checkAndSetEventIdempotent(event.eventId);
      if (isNew) {
        newEvents.push(event);
      } else {
        duplicatesCount++;
      }
    }

    return { newEvents, duplicatesCount };
  }

  private cleanExpiredMemoryKeys(now: number): void {
    if (this.memoryCache.size < 5000) return;
    for (const [key, expiry] of this.memoryCache.entries()) {
      if (expiry <= now) {
        this.memoryCache.delete(key);
      }
    }
  }
}

export const telemetryIdempotencyService = new TelemetryIdempotencyService();
