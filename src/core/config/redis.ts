import Redis from 'ioredis';
import { env } from './env.config';
import { logger } from './logger';

export let redisClient: Redis;
let isRedisReady = false;

// Debounce state to avoid flooding logs during transient network reconnects
let lastErrorLogTimestamp = 0;
let lastLoggedErrorMessage = '';

export const initRedis = (): Redis => {
  if (redisClient) {
    return redisClient;
  }

  const isTls = env.REDIS_URL.startsWith('rediss://');

  redisClient = new Redis(env.REDIS_URL, {
    keyPrefix: env.REDIS_KEY_PREFIX,
    tls: isTls ? { rejectUnauthorized: false } : undefined,
    keepAlive: 10000, // TCP keep-alive to prevent cloud serverless connection drop
    enableReadyCheck: true,
    retryStrategy: (times) => {
      // Exponential backoff between 1s and 5s
      const delay = Math.min(1000 * Math.pow(1.4, Math.min(times, 6)), 5000);
      return delay;
    },
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    logger.info('🔗 Connecting to Redis cache & geo layer...');
  });

  redisClient.on('ready', () => {
    isRedisReady = true;
    logger.info(`✅ Connected to Redis at ${env.REDIS_URL.replace(/:([^:@]+)@/, ':****@')}`);
  });

  redisClient.on('error', (err) => {
    isRedisReady = false;
    const now = Date.now();
    // Throttle duplicate warning logs to once every 10 seconds
    if (err.message !== lastLoggedErrorMessage || now - lastErrorLogTimestamp > 10000) {
      lastErrorLogTimestamp = now;
      lastLoggedErrorMessage = err.message;
      logger.warn(`⚠️ Redis connection issue: ${err.message}`);
    }
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
