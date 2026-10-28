import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';
import { TelemetryEvent } from './telemetry.types';

export class TelemetryQueueService {
  private readonly REDIS_QUEUE_KEY = 'telemetry:queue:incoming';
  private readonly REDIS_DLQ_KEY = 'telemetry:queue:dead_letter';

  // In-memory high-throughput ring-buffer queue for offline Redis resilience
  private memoryQueue: TelemetryEvent[] = [];
  private readonly MAX_MEMORY_QUEUE_CAP = 50000;

  // Running metrics
  private totalEnqueued = 0;
  private totalDequeued = 0;

  /**
   * Pushes a batch of telemetry events directly to the asynchronous queue.
   * Avoids blocking API responses or exhausting database connection pools.
   */
  public async enqueueBatch(events: TelemetryEvent[]): Promise<number> {
    if (!events || events.length === 0) return 0;

    this.totalEnqueued += events.length;

    if (isRedisConnected()) {
      try {
        const client = getRedisClient();
        const serialized = events.map((e) => JSON.stringify(e));

        // Redis RPUSH supports multi-item batch in a single network round-trip
        const queueLen = await client.rpush(this.REDIS_QUEUE_KEY, ...serialized);
        return queueLen;
      } catch (err: any) {
        logger.warn(`Redis queue push failed (${err.message}). Buffering to in-memory fallback.`);
      }
    }

    // In-memory fallback ring buffer
    const availableSlots = this.MAX_MEMORY_QUEUE_CAP - this.memoryQueue.length;
    const toPush = events.slice(0, Math.max(0, availableSlots));
    this.memoryQueue.push(...toPush);

    if (events.length > toPush.length) {
      logger.error(`Memory queue reached capacity cap (${this.MAX_MEMORY_QUEUE_CAP}). Dropped ${events.length - toPush.length} events.`);
    }

    return this.memoryQueue.length;
  }

  /**
   * Dequeues a micro-batch of up to `maxBatchSize` events (default: 500).
   * Enables batch-insertion into MongoDB / ClickHouse / PostgreSQL without per-request overhead.
   */
  public async dequeueBatch(maxBatchSize: number = 500): Promise<TelemetryEvent[]> {
    const batch: TelemetryEvent[] = [];

    // 1. Drain from in-memory fallback first if items exist
    if (this.memoryQueue.length > 0) {
      const popped = this.memoryQueue.splice(0, maxBatchSize);
      this.totalDequeued += popped.length;
      return popped;
    }

    // 2. Drain from Redis queue
    if (isRedisConnected()) {
      try {
        const client = getRedisClient();
        // Redis 6.2+ supports LPOP key count
        const items = await client.lpop(this.REDIS_QUEUE_KEY, maxBatchSize);

        if (items) {
          const rawList = Array.isArray(items) ? items : [items];
          for (const raw of rawList) {
            try {
              batch.push(JSON.parse(raw));
            } catch (jsonErr: any) {
              logger.warn(`Malformed queue item JSON: ${jsonErr.message}`);
              await client.rpush(this.REDIS_DLQ_KEY, raw);
            }
          }
          this.totalDequeued += batch.length;
        }
      } catch (err: any) {
        logger.warn(`Redis dequeue batch error: ${err.message}`);
      }
    }

    return batch;
  }

  /**
   * Returns current queue backlog length across Redis and memory fallback.
   */
  public async getQueueLength(): Promise<number> {
    let count = this.memoryQueue.length;
    if (isRedisConnected()) {
      try {
        const client = getRedisClient();
        count += await client.llen(this.REDIS_QUEUE_KEY);
      } catch (err: any) {
        logger.debug(`Redis llen query error: ${err.message}`);
      }
    }
    return count;
  }

  /**
   * Returns queue monitoring statistics.
   */
  public async getQueueStats(): Promise<{
    pendingBacklog: number;
    backend: 'redis' | 'memory';
    totalEnqueued: number;
    totalDequeued: number;
  }> {
    const pendingBacklog = await this.getQueueLength();
    return {
      pendingBacklog,
      backend: isRedisConnected() ? 'redis' : 'memory',
      totalEnqueued: this.totalEnqueued,
      totalDequeued: this.totalDequeued,
    };
  }
}

export const telemetryQueueService = new TelemetryQueueService();
