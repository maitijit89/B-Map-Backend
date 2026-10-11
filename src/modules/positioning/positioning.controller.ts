import { Request, Response } from 'express';
import { BeaconAnchorModel } from './beacon-anchor.model';
import { positioningEngineService } from './positioning-engine.service';
import { rtkCorrectionService } from './rtk-correction.service';
import { weakSignalResolverService } from './weak-signal-resolver.service';
import { RawSensorPacket } from './positioning.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class PositioningController {
  /**
   * POST /api/v1/positioning/fuse
   * Ingests sensor packet (GNSS + IMU + Odometry + Wi-Fi/BLE) and returns fused state
   */
  async fusePosition(req: Request, res: Response): Promise<void> {
    try {
      const packet = req.body as RawSensorPacket;

      if (!packet || !packet.deviceId) {
        sendError(res, 400, 'deviceId and sensor telemetry are required');
        return;
      }

      const fused = await positioningEngineService.processSensorPacket(packet);

      sendSuccess({
        res,
        message: 'Position fused successfully',
        data: fused,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/positioning/anchors
   * Registers a ground-truth BLE beacon or Wi-Fi anchor in an underground/tunnel facility
   */
  async registerAnchor(req: Request, res: Response): Promise<void> {
    try {
      const {
        uuid,
        major,
        minor,
        facilityName,
        facilityType,
        floorLevel,
        coordinates,
        txPowerAt1m,
        description,
      } = req.body;

      if (!uuid || major === undefined || minor === undefined || !coordinates || !facilityName) {
        sendError(res, 400, 'uuid, major, minor, facilityName, and coordinates [lon, lat] are required');
        return;
      }

      const anchor = await weakSignalResolverService.registerAnchor({
        uuid,
        major,
        minor,
        facilityName,
        facilityType: facilityType || 'underground_parking',
        floorLevel: floorLevel ?? -1,
        coordinates,
        txPowerAt1m,
        description,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Anchor registered successfully',
        data: anchor,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * GET /api/v1/positioning/anchors/nearby
   * Finds registered anchors near a coordinate
   */
  async getNearbyAnchors(req: Request, res: Response): Promise<void> {
    try {
      const { longitude, latitude, radius } = req.query;

      if (!longitude || !latitude) {
        sendError(res, 400, 'longitude and latitude query params are required');
        return;
      }

      const lon = parseFloat(longitude as string);
      const lat = parseFloat(latitude as string);
      const radiusMeters = radius ? parseFloat(radius as string) : 500;

      const anchors = await BeaconAnchorModel.find({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lon, lat] },
            $maxDistance: radiusMeters,
          },
        },
      }).limit(50).exec();

      sendSuccess({
        res,
        message: `Found ${anchors.length} nearby anchors`,
        data: anchors,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/positioning/rtk/base-station
   * Registers a high-precision CORS RTK base station
   */
  async registerBaseStation(req: Request, res: Response): Promise<void> {
    try {
      const { id, name, coordinates, elevationMeters } = req.body;

      if (!id || !name || !coordinates) {
        sendError(res, 400, 'id, name, and coordinates [lon, lat] are required');
        return;
      }

      rtkCorrectionService.registerBaseStation({
        id,
        name,
        coordinates,
        elevationMeters: elevationMeters || 0,
        lastCorrectionTimestamp: Date.now(),
        isOnline: true,
      });

      sendSuccess({
        res,
        message: 'Base station registered successfully',
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }
}

export const positioningController = new PositioningController();
