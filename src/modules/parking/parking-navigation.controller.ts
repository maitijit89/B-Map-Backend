import { Request, Response } from 'express';
import { parkingSpaceNavigationService } from './parking-space-navigation.service';
import { Coordinate } from '../../core/types/geo.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class ParkingNavigationController {
  /**
   * Detects outdoor-to-indoor transition when vehicle approaches parking garage entrance
   */
  async detectEntrance(req: Request, res: Response): Promise<void> {
    try {
      const { coordinates, thresholdMeters } = req.body;
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        sendError(res, 400, 'coordinates [lon, lat] is required');
        return;
      }

      const coord: Coordinate = [coordinates[0], coordinates[1]];
      const result = parkingSpaceNavigationService.detectFacilityEntrance(coord, thresholdMeters);
      sendSuccess({
        res,
        message: 'Facility entrance transition evaluated',
        data: result,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Gets facility details
   */
  async getFacility(req: Request, res: Response): Promise<void> {
    try {
      const facilityId = req.params.facilityId as string;
      const facility = parkingSpaceNavigationService.getFacility(facilityId);
      if (!facility) {
        sendError(res, 404, `Facility not found: ${facilityId}`);
        return;
      }
      sendSuccess({
        res,
        message: 'Facility retrieved successfully',
        data: facility,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Searches bays with filters
   */
  async searchBays(req: Request, res: Response): Promise<void> {
    try {
      const facilityId = req.params.facilityId as string;
      const floorLevel = req.query.floorLevel !== undefined ? parseInt(req.query.floorLevel as string, 10) : undefined;
      const bayType = req.query.bayType as any;
      const status = req.query.status as any;
      const evChargingRequired = req.query.evChargingRequired === 'true';
      const maxDistanceToElevator = req.query.maxDistanceToElevator
        ? parseFloat(req.query.maxDistanceToElevator as string)
        : undefined;

      const bays = await parkingSpaceNavigationService.searchParkingBays(facilityId, {
        floorLevel,
        bayType,
        status,
        evChargingRequired,
        maxDistanceToElevatorMeters: maxDistanceToElevator,
      });

      sendSuccess({
        res,
        message: 'Parking bays retrieved successfully',
        data: { count: bays.length, bays },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Plans step-by-step indoor navigation to designated parking bay
   */
  async planIndoorRoute(req: Request, res: Response): Promise<void> {
    try {
      const { facilityId, entranceGateId, targetBayId } = req.body;
      if (!facilityId || !targetBayId) {
        sendError(res, 400, 'facilityId and targetBayId are required');
        return;
      }

      const plan = await parkingSpaceNavigationService.planIndoorBayNavigation({
        facilityId,
        entranceGateId,
        targetBayId,
      });

      sendSuccess({
        res,
        message: 'Indoor parking bay route planned successfully',
        data: plan,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * "Find My Car" reverse pedestrian walking navigation
   */
  async planFindMyCar(req: Request, res: Response): Promise<void> {
    try {
      const { facilityId, startType, targetBayId } = req.body;
      if (!facilityId || !targetBayId) {
        sendError(res, 400, 'facilityId and targetBayId are required');
        return;
      }

      const plan = await parkingSpaceNavigationService.planFindMyCarRoute({
        facilityId,
        startType: startType || 'elevator',
        targetBayId,
      });

      sendSuccess({
        res,
        message: 'Find My Car pedestrian walking route planned',
        data: plan,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Reserves a parking spot
   */
  async reserveBay(req: Request, res: Response): Promise<void> {
    try {
      const { facilityId, bayId, userId, durationMinutes } = req.body;
      if (!facilityId || !bayId || !userId) {
        sendError(res, 400, 'facilityId, bayId, and userId are required');
        return;
      }

      const reservation = await parkingSpaceNavigationService.reserveParkingBay({
        facilityId,
        bayId,
        userId,
        durationMinutes,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Parking bay reserved successfully',
        data: reservation,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Digital check-in upon arrival
   */
  async checkInBay(req: Request, res: Response): Promise<void> {
    try {
      const { facilityId, bayId, reservationId } = req.body;
      if (!facilityId || !bayId) {
        sendError(res, 400, 'facilityId and bayId are required');
        return;
      }

      const result = await parkingSpaceNavigationService.checkInParkingBay({
        facilityId,
        bayId,
        reservationId,
      });

      sendSuccess({
        res,
        message: 'Check-in confirmed, parking session started',
        data: result,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Digital check-out and fee settlement
   */
  async checkOutBay(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        sendError(res, 400, 'sessionId is required');
        return;
      }

      const result = await parkingSpaceNavigationService.checkOutParkingBay(sessionId);
      sendSuccess({
        res,
        message: 'Check-out completed and fee calculated',
        data: result,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }
}

export const parkingNavigationController = new ParkingNavigationController();
