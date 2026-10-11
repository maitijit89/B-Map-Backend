import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../core/utils/api-response';
import { activityRecognitionService } from './activity-recognition.service';

export class MotionFitnessController {
  /**
   * POST /api/v1/motion/activity
   * Ingests physical activity recognition state (STILL, WALKING, DRIVING, etc.) alongside coordinates.
   * Performs algorithmic state switching (auto-pause, arrival confirmation, traffic check).
   */
  async recordActivity(req: Request, res: Response): Promise<void> {
    try {
      const {
        tripId,
        userId,
        activity,
        confidence = 100,
        coordinates,
        speed,
        heading,
        timestamp,
        permissions,
        trafficCongestionLevel,
      } = req.body;

      if (!tripId || !userId || !activity) {
        sendError(res, 400, 'tripId, userId, and activity (e.g. STILL, WALKING, DRIVING) are required.');
        return;
      }

      const result = await activityRecognitionService.processActivityUpdate({
        tripId,
        userId,
        activity,
        confidence: Number(confidence),
        coordinates,
        speed,
        heading,
        timestamp,
        permissions,
        trafficCongestionLevel,
      });

      sendSuccess({
        res,
        statusCode: 200,
        message:
          result.actionTriggered !== 'NONE'
            ? `Activity processed. Triggered action: ${result.actionTriggered}`
            : 'Activity processed successfully',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/motion/resume
   * Manually resumes an auto-paused trip.
   */
  async resumeTrip(req: Request, res: Response): Promise<void> {
    try {
      const { tripId } = req.body;
      if (!tripId) {
        sendError(res, 400, 'tripId is required to resume trip.');
        return;
      }

      await activityRecognitionService.resumeTrip(tripId);

      sendSuccess({
        res,
        statusCode: 200,
        message: `Trip ${tripId} resumed successfully.`,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * GET /api/v1/motion/trip/:tripId
   * Retrieves active activity tracking state for a trip.
   */
  async getTripActivity(req: Request, res: Response): Promise<void> {
    try {
      const { tripId } = req.params;
      const state = activityRecognitionService.getTripMotionState(tripId as string);

      if (!state) {
        sendError(res, 404, `No activity tracking state found for trip "${tripId}".`);
        return;
      }

      sendSuccess({
        res,
        statusCode: 200,
        data: state,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }
}

export const motionFitnessController = new MotionFitnessController();
