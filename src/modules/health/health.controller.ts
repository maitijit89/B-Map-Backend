import axios from 'axios';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { env } from '../../core/config/env.config';
import { isRedisConnected } from '../../core/config/redis';
import { sendSuccess } from '../../core/utils/api-response';
import { aiCopilotService } from '../ai-copilot/ai-copilot.service';

export const getHealthStatus = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = isRedisConnected() ? 'connected' : 'disconnected/fallback';

  // Sub-50ms Kubernetes HPA Liveness / Readiness probe path
  const isK8sProbe = req.query.probe === 'true' || req.query.fast === 'true' || req.headers['x-k8s-probe'] === 'true';
  if (isK8sProbe) {
    const isHealthy = mongoStatus === 'connected' || env.NODE_ENV === 'development';
    sendSuccess({
      res,
      statusCode: isHealthy ? 200 : 503,
      message: 'B-Map Kubernetes Probe Status',
      data: {
        status: isHealthy ? 'healthy' : 'degraded',
        responseTimeMs: Date.now() - startTime,
        k8sProbe: true,
        services: {
          mongodb: mongoStatus,
          redis: redisStatus,
        },
      },
    });
    return;
  }

  let osrmStatus = 'unreachable';
  try {
    const testUrl = `${env.OSRM_BASE_URL}/route/v1/driving/13.388860,52.517037;13.397634,52.529407?overview=false`;
    const resp = await axios.get(testUrl, { timeout: 2000 });
    if (resp.status === 200 && resp.data.code === 'Ok') {
      osrmStatus = 'healthy';
    }
  } catch {
    osrmStatus = 'offline_or_limited';
  }

  // Query AI Ecosystem & Gemma LLM health status
  const aiStatus = await aiCopilotService.getComprehensiveAIStatus().catch(() => ({
    serverUrl: env.AI_BACKEND_URL,
    websocketGateway: env.AI_BACKEND_WS_URL,
    environment: env.APP_ENV,
    gemmaModelUrl: env.GEMMA_MODEL_URL,
    autoStartModel: env.AUTO_START_GEMMA,
    aiBackend: { backend: 'offline', socketGateway: 'offline' },
    gemmaModel: { status: 'offline', is_ready: false },
    webSocketBridge: { isConnected: false },
  }));

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
        aiMicroservice: {
          serverUrl: env.AI_BACKEND_URL,
          websocketGateway: env.AI_BACKEND_WS_URL,
          status: aiStatus.aiBackend.backend,
          socketGateway: aiStatus.aiBackend.socketGateway,
          webSocketBridgeConnected: (aiStatus.webSocketBridge as any).isConnected,
        },
        gemmaModel: {
          url: env.GEMMA_MODEL_URL,
          status: (aiStatus.gemmaModel as any).status || 'offline',
          isReady: (aiStatus.gemmaModel as any).is_ready || false,
          autoStart: env.AUTO_START_GEMMA,
        },
      },
      environment: env.NODE_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
};

