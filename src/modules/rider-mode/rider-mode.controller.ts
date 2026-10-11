import { Request, Response } from 'express';
import { riderModeService } from './rider-mode.service';
import { Coordinate } from '../../core/types/geo.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class RiderModeController {
  /**
   * Plans motorcycle and two-wheeler specialized route
   */
  async planRiderRoute(req: Request, res: Response): Promise<void> {
    try {
      const { origin, destination, preferences } = req.body;
      if (!origin || !destination) {
        sendError(res, 400, 'origin [lon, lat] and destination [lon, lat] are required');
        return;
      }

      const origCoord: Coordinate = [origin[0], origin[1]];
      const destCoord: Coordinate = [destination[0], destination[1]];

      const plan = await riderModeService.planRiderRoute({
        origin: origCoord,
        destination: destCoord,
        preferences,
      });

      sendSuccess({
        res,
        message: 'Rider route planned successfully',
        data: plan,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Ingests rider dynamics telemetry (lean angle, yaw rate, lateral acceleration)
   */
  async processDynamics(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, telemetry, weather } = req.body;
      if (!sessionId || !telemetry) {
        sendError(res, 400, 'sessionId and telemetry are required');
        return;
      }

      const leanStats = riderModeService.processDynamics(sessionId, telemetry, weather);
      sendSuccess({
        res,
        message: 'Rider dynamics and lean angle evaluated',
        data: leanStats,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Evaluates weather and crosswinds for two-wheeler safety
   */
  async evaluateWeatherSafety(req: Request, res: Response): Promise<void> {
    try {
      const { weather, isBridgeOrViaduct } = req.body;
      if (!weather) {
        sendError(res, 400, 'weather condition is required');
        return;
      }

      const alerts = riderModeService.evaluateWeatherSafety(weather, isBridgeOrViaduct);
      sendSuccess({
        res,
        message: 'Two-wheeler weather safety alerts evaluated',
        data: { alerts },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Generates ultra-concise Bluetooth helmet audio cue
   */
  async generateHelmetCue(req: Request, res: Response): Promise<void> {
    try {
      const { instruction, distanceMeters, hazardAlert } = req.body;
      if (!instruction || distanceMeters === undefined) {
        sendError(res, 400, 'instruction and distanceMeters are required');
        return;
      }

      const cue = riderModeService.generateHelmetAudioCue({
        instruction,
        distanceMeters,
        hazardAlert,
      });

      sendSuccess({
        res,
        message: 'Helmet audio cue generated',
        data: cue,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Returns oversized glove-friendly UI layout
   */
  async getGloveUILayout(req: Request, res: Response): Promise<void> {
    try {
      const mode = (req.query.mode as any) || 'glove_touch_high_contrast';
      const layout = riderModeService.getGloveUILayout(mode);
      sendSuccess({
        res,
        message: 'Glove UI layout retrieved',
        data: layout,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Evaluates crash detection trigger (e-Call)
   */
  async evaluateCrashTrigger(req: Request, res: Response): Promise<void> {
    try {
      const { telemetry, stationarySeconds, location, medicalProfile } = req.body;
      if (!telemetry || stationarySeconds === undefined || !location) {
        sendError(res, 400, 'telemetry, stationarySeconds, and location are required');
        return;
      }

      const locCoord: Coordinate = [location[0], location[1]];

      const crashEvent = riderModeService.evaluateCrashTrigger({
        telemetry,
        stationarySeconds,
        location: locCoord,
        medicalProfile,
      });

      if (crashEvent) {
        sendSuccess({
          res,
          statusCode: 201,
          message: 'Rider crash event detected',
          data: { detected: true, crashEvent },
        });
        return;
      }
      sendSuccess({
        res,
        message: 'No crash detected',
        data: { detected: false },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Cancels pending crash e-Call alert
   */
  async cancelCrashAlert(req: Request, res: Response): Promise<void> {
    try {
      const eventId = req.params.eventId as string;
      const cancelled = riderModeService.cancelCrashAlert(eventId);
      if (cancelled) {
        sendSuccess({
          res,
          message: 'Crash alert cancelled',
          data: { eventId, status: 'cancelled_by_rider' },
        });
        return;
      }
      sendError(res, 404, `Crash event not found: ${eventId}`);
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Queries nearby two-wheeler hazards
   */
  async getNearbyHazards(req: Request, res: Response): Promise<void> {
    try {
      const lon = parseFloat(req.query.longitude as string);
      const lat = parseFloat(req.query.latitude as string);
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 5000;

      if (isNaN(lon) || isNaN(lat)) {
        sendError(res, 400, 'Valid longitude and latitude query parameters required');
        return;
      }

      const hazards = await riderModeService.getNearbyHazards([lon, lat], radius);
      sendSuccess({
        res,
        message: 'Nearby rider hazards retrieved',
        data: { count: hazards.length, hazards },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Reports a new rider hazard
   */
  async reportHazard(req: Request, res: Response): Promise<void> {
    try {
      const { type, location, severity, warningMessage } = req.body;
      if (!type || !location || !warningMessage) {
        sendError(res, 400, 'type, location [lon, lat], and warningMessage are required');
        return;
      }

      const locCoord: Coordinate = [location[0], location[1]];

      const report = await riderModeService.reportHazard({
        type,
        location: locCoord,
        severity: severity || 'medium',
        warningMessage,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Rider hazard reported successfully',
        data: report,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }
}

export const riderModeController = new RiderModeController();
