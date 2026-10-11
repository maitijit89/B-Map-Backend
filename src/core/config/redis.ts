import Redis from 'ioredis';
import { env } from './env.config';
import { logger } from './logger';

export let redisClient: Redis;
let isRedisReady = false;

export const initRedis = (): Redis => {
  const isTls = env.REDIS_URL.startsWith('rediss://');

  redisClient = new Redis(env.REDIS_URL, {
    keyPrefix: env.REDIS_KEY_PREFIX,
    tls: isTls ? { rejectUnauthorized: false } : undefined,
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    logger.info('🔗 Connecting to Redis cache & geo layer...');
  });

  redisClient.on('ready', () => {
    isRedisReady = true;
    logger.info(`✅ Connected to Redis at ${env.REDIS_URL}`);
  });

  redisClient.on('error', (err) => {
    isRedisReady = false;
    logger.warn(`⚠️ Redis connection issue: ${err.message}`);
  });

  redisClient.on('close', () => {
    isRedisReady = false;
  });

  // Attempt initial connection asynchronously
  redisClient.connect().catch((err) => {
    logger.warn(`⚠️ Redis failed to connect initially (${err.message}). In-memory or bypass fallback will be used where applicable.`);
  });

  return redisClient;
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    return initRedis();
  }
  return redisClient;
};

export const isRedisConnected = (): boolean => isRedisReady;

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection gracefully closed.');
  }
};
