import { Request, Response } from 'express';
import { laneRoutingService } from './lane-routing.service';
import { veteranDriverLayerService } from './veteran-driver-layer.service';
import { Coordinate } from '../../core/types/geo.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class LaneRoutingController {
  /**
   * POST /api/v1/lane-routing/guidance
   * Real-time Lane-Level Guidance: evaluates current lane, restrictions, and computes early change prompt
   */
  async getLaneGuidance(req: Request, res: Response): Promise<void> {
    try {
      const {
        roadName,
        currentCoordinates,
        currentLaneIndex,
        distanceToNextTurnMeters,
        nextManeuverDirection,
        currentSpeedMps,
        timestamp,
      } = req.body;

      if (distanceToNextTurnMeters === undefined || !nextManeuverDirection) {
        sendError(res, 400, 'distanceToNextTurnMeters and nextManeuverDirection are required');
        return;
      }

      const guidance = await laneRoutingService.computeLaneGuidance({
        roadName,
        currentCoordinates,
        currentLaneIndex,
        distanceToNextTurnMeters: parseFloat(distanceToNextTurnMeters),
        nextManeuverDirection,
        currentSpeedMps: currentSpeedMps ? parseFloat(currentSpeedMps) : undefined,
        timestamp,
      });

      sendSuccess({
        res,
        message: 'Lane-level guidance computed',
        data: guidance,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/lane-routing/plan
   * Plans route infused with the "Veteran Driver" Experience Layer (veteran_fast, veteran_smooth, novice_friendly)
   */
  async planVeteranRoute(req: Request, res: Response): Promise<void> {
    try {
      const { origin, destination, style, avoidHazards, allowAlleyShortcuts } = req.body;

      if (!origin || !destination) {
        sendError(res, 400, 'origin [lon, lat] and destination [lon, lat] are required');
        return;
      }

      const result = await veteranDriverLayerService.planVeteranEnhancedRoute({
        origin: origin as Coordinate,
        destination: destination as Coordinate,
        style: style || 'veteran_fast',
        avoidHazards,
        allowAlleyShortcuts,
      });

      sendSuccess({
        res,
        message: `Route generated using ${result.analysis.chosenStyle} veteran layer`,
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/lane-routing/veteran/experience
   * Ingest crowdsourced veteran driver report or hazard
   */
  async reportVeteranExperience(req: Request, res: Response): Promise<void> {
    try {
      const experience = req.body;

      if (!experience.segmentId || !experience.roadName || !experience.geometry) {
        sendError(res, 400, 'segmentId, roadName, and geometry are required');
        return;
      }

      const saved = await veteranDriverLayerService.reportExperience(experience);

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Veteran driver experience layer updated',
        data: saved,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/lane-routing/segments
   * Register an HD lane segment in the network
   */
  async registerLaneSegment(req: Request, res: Response): Promise<void> {
    try {
      const segment = req.body;

      if (!segment.segmentId || !segment.roadName || !segment.lanes) {
        sendError(res, 400, 'segmentId, roadName, and lanes are required');
        return;
      }

      const saved = await laneRoutingService.registerLaneSegment(segment);

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Lane segment registered successfully',
        data: saved,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }
}

export const laneRoutingController = new LaneRoutingController();
