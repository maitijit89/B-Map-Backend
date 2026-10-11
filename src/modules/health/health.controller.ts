import axios from 'axios';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { env } from '../../core/config/env.config';
import { isRedisConnected } from '../../core/config/redis';
import { sendSuccess } from '../../core/utils/api-response';

export const getHealthStatus = async (_req: Request, res: Response): Promise<void> => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = isRedisConnected() ? 'connected' : 'disconnected/fallback';

  let osrmStatus = 'unreachable';
  try {
    const testUrl = `${env.OSRM_BASE_URL}/route/v1/driving/13.388860,52.517037;13.397634,52.529407?overview=false`;
    const resp = await axios.get(testUrl, { timeout: 3000 });
    if (resp.status === 200 && resp.data.code === 'Ok') {
      osrmStatus = 'healthy';
    }
  } catch {
    osrmStatus = 'offline_or_limited';
  }

  const isHealthy = mongoStatus === 'connected' || env.NODE_ENV === 'development';

  sendSuccess({
    res,
    statusCode: isHealthy ? 200 : 503,
    message: 'B-Map Navigation Backend Health Check',
    data: {
      status: isHealthy ? 'healthy' : 'degraded',
      services: {
        mongodb: mongoStatus,
        redis: redisStatus,
        osrmRoutingEngine: {
          status: osrmStatus,
          baseUrl: env.OSRM_BASE_URL,
        },
      },
      environment: env.NODE_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
};
