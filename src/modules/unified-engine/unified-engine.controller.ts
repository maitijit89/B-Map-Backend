import { Request, Response } from 'express';
import { dynamicRecommendationService } from './dynamic-recommendation.service';
import { unifiedUnderlyingEngineService } from './unified-underlying-engine.service';
import { UnifiedTelemetryTick } from './unified-engine.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class UnifiedEngineController {
  /**
   * POST /api/v1/unified/session/start
   * Start a new unified navigation session
   */
  async startSession(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, userId, origin, destination, routingStyle, batteryOrFuelPercentage } = req.body;

      if (!deviceId || !origin || !destination) {
        sendError(res, 400, 'deviceId, origin [lon, lat], and destination [lon, lat] are required');
        return;
      }

      const context = await unifiedUnderlyingEngineService.startUnifiedSession({
        deviceId,
        userId,
        origin,
        destination,
        routingStyle,
        batteryOrFuelPercentage,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Unified underlying navigation session initialized',
        data: {
          sessionId: context.sessionId,
          deviceId: context.deviceId,
          routingStyle: context.routingStyle,
          activeRoute: context.activeRoute,
        },
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/unified/tick
   * Process a single real-time telemetry tick through the complete unified pipeline
   */
  async processTick(req: Request, res: Response): Promise<void> {
    try {
      const tick = req.body as UnifiedTelemetryTick;

      if (!tick || !tick.sensorPacket || !tick.sensorPacket.deviceId) {
        sendError(res, 400, 'sensorPacket with valid deviceId is required');
        return;
      }

      const state = await unifiedUnderlyingEngineService.processUnifiedTick(tick);

      sendSuccess({
        res,
        message: 'Unified underlying engine tick processed',
        data: state,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/unified/recommendations/accept
   * Accept a dynamic recommendation (e.g. switch to faster route, add parking waypoint)
   */
  async acceptRecommendation(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, recommendationId } = req.body;

      if (!sessionId || !recommendationId) {
        sendError(res, 400, 'sessionId and recommendationId are required');
        return;
      }

      const session = unifiedUnderlyingEngineService.getSession(sessionId);
      if (!session) {
        sendError(res, 404, 'Session not found');
        return;
      }

      const accepted = dynamicRecommendationService.acceptRecommendation(session, recommendationId);
      if (!accepted) {
        sendError(res, 404, 'Recommendation not found or expired');
        return;
      }

      sendSuccess({
        res,
        message: 'Recommendation accepted successfully',
        data: accepted,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/unified/recommendations/dismiss
   * Dismiss a dynamic recommendation
   */
  async dismissRecommendation(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, recommendationId } = req.body;

      if (!sessionId || !recommendationId) {
        sendError(res, 400, 'sessionId and recommendationId are required');
        return;
      }

      const session = unifiedUnderlyingEngineService.getSession(sessionId);
      if (!session) {
        sendError(res, 404, 'Session not found');
        return;
      }

      dynamicRecommendationService.dismissRecommendation(session, recommendationId);

      sendSuccess({
        res,
        message: 'Recommendation dismissed',
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }
}

export const unifiedEngineController = new UnifiedEngineController();
