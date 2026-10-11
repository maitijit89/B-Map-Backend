import { Request, Response } from 'express';
import { navigationService } from './navigation.service';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class NavigationController {
  /**
   * POST /api/v1/navigation/start
   * Start a new turn-by-turn session
   */
  async startNavigation(req: Request, res: Response): Promise<void> {
    try {
      const { userId, origin, destination, waypoints, profile } = req.body;

      if (!userId || !origin || !destination) {
        sendError(res, 400, 'userId, origin [lon, lat], and destination [lon, lat] are required');
        return;
      }

      const session = await navigationService.startSession({
        userId,
        origin,
        destination,
        waypoints,
        profile,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Navigation session initiated',
        data: session,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/navigation/progress
   * Submit progress update via REST
   */
  async updateProgress(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, currentLocation, heading, speed, accuracy } = req.body;

      if (!sessionId || !currentLocation) {
        sendError(res, 400, 'sessionId and currentLocation [lon, lat] are required');
        return;
      }

      const progress = await navigationService.processProgressUpdate({
        sessionId,
        currentLocation,
        heading,
        speed,
        accuracy,
      });

      sendSuccess({
        res,
        message: progress.isOffRoute ? 'Off route detected' : 'Progress updated',
        data: progress,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * GET /api/v1/navigation/:sessionId
   * Get current session status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const session = await navigationService.getSession(req.params.sessionId as string);
      if (!session) {
        sendError(res, 404, 'Navigation session not found');
        return;
      }

      sendSuccess({
        res,
        data: session,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/navigation/:sessionId/end
   * End navigation session
   */
  async endNavigation(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.body;
      await navigationService.endSession(req.params.sessionId as string, status || 'completed');

      sendSuccess({
        res,
        message: 'Navigation session ended',
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }
}

export const navigationController = new NavigationController();
