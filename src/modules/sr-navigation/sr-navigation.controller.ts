import { Request, Response } from 'express';
import { srNavigationService } from './sr-navigation.service';
import { Coordinate } from '../../core/types/geo.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class SRNavigationController {
  /**
   * Computes sub-meter reality HUD state with lateral offset and 3D junction cards
   */
  async computeSRHUDState(req: Request, res: Response): Promise<void> {
    try {
      const {
        coordinates,
        speedKmh,
        speedLimitKmh,
        lateralOffsetMeters,
        currentLaneIndex,
        nextTurnDirection,
        distanceToTurnMeters,
        blinkerState,
        surroundingObjects,
      } = req.body;

      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        sendError(res, 400, 'coordinates [lon, lat] is required');
        return;
      }

      const coord: Coordinate = [coordinates[0], coordinates[1]];

      const hudState = await srNavigationService.computeSRHUDState({
        coordinates: coord,
        speedKmh,
        speedLimitKmh,
        lateralOffsetMeters,
        currentLaneIndex,
        nextTurnDirection,
        distanceToTurnMeters,
        blinkerState,
        surroundingObjects,
      });

      sendSuccess({
        res,
        message: 'SR Navigation HUD state calculated successfully',
        data: hudState,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Registers a new HD Road Model with 3D boundaries and markings
   */
  async registerSRRoad(req: Request, res: Response): Promise<void> {
    try {
      const { segmentId, roadName, boundaries, markings, junctionCard } = req.body;
      if (!segmentId || !roadName || !boundaries) {
        sendError(res, 400, 'segmentId, roadName, and boundaries are required');
        return;
      }

      const road = await srNavigationService.registerSRRoadModel({
        segmentId,
        roadName,
        boundaries,
        markings: markings || [],
        junctionCard,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: 'SR HD road model registered successfully',
        data: road,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Gets HD Road Model by Segment ID
   */
  async getSRRoad(req: Request, res: Response): Promise<void> {
    try {
      const segmentId = req.params.segmentId as string;
      const road = await srNavigationService.getSRRoadModel(segmentId);
      if (!road) {
        sendError(res, 404, `SR road model not found: ${segmentId}`);
        return;
      }
      sendSuccess({
        res,
        message: 'SR road model retrieved successfully',
        data: road,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }
}

export const srNavigationController = new SRNavigationController();
