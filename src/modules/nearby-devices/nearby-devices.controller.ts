import { Request, Response } from 'express';
import { logger } from '../../core/config/logger';
import { indoorBeaconMappingService } from './indoor-beacon-mapping.service';
import {
  BluetoothClientPermissions,
  IndoorBeaconRecord,
  IndoorBeaconTranslationRequest,
  IndoorFacilityType,
} from './nearby-devices.types';

export class NearbyDevicesController {
  /**
   * POST /api/v1/nearby-devices/beacons/translate
   * Translates client-scanned BLE beacon IDs and signal metrics into exact indoor X/Y coordinates
   */
  async translateScannedBeacons(req: Request, res: Response): Promise<void> {
    try {
      const payload: IndoorBeaconTranslationRequest = req.body;

      if (!payload.beacons || !Array.isArray(payload.beacons) || payload.beacons.length === 0) {
        res.status(400).json({
          status: 'error',
          error: 'BAD_REQUEST',
          message: 'Request body must include a non-empty array of scanned beacons ("beacons").',
        });
        return;
      }

      // Check client Bluetooth permissions first
      if (payload.permissions) {
        const permCheck = indoorBeaconMappingService.verifyBluetoothPermissions(payload.permissions);
        if (!permCheck.isValid) {
          res.status(403).json({
            status: 'error',
            error: permCheck.errorCode || 'BLUETOOTH_PERMISSION_DENIED',
            message: permCheck.message,
            missingPermissions: permCheck.missingPermissions,
            platform: permCheck.platform,
          });
          return;
        }
      }

      const result = await indoorBeaconMappingService.translateBeaconsToIndoorCoordinates(payload);

      res.status(200).json({
        status: 'success',
        message: 'Scanned BLE beacons translated into exact indoor coordinates successfully.',
        data: result,
      });
    } catch (err: any) {
      logger.error(`Error translating scanned beacons: ${err.message}`);
      const isNotFound = err.message.includes('None of the scanned beacon IDs matched');
      res.status(isNotFound ? 404 : 400).json({
        status: 'error',
        error: isNotFound ? 'BEACONS_NOT_FOUND_IN_DATABASE' : 'TRANSLATION_FAILED',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/v1/nearby-devices/permissions/verify
   * Validates client Bluetooth permissions (BLUETOOTH_SCAN, BLUETOOTH_CONNECT, Bluetooth Sharing)
   */
  async verifyBluetoothPermissions(req: Request, res: Response): Promise<void> {
    try {
      const permissions: BluetoothClientPermissions = req.body;
      const result = indoorBeaconMappingService.verifyBluetoothPermissions(permissions);

      if (!result.isValid) {
        res.status(403).json({
          status: 'error',
          error: result.errorCode || 'BLUETOOTH_PERMISSION_DENIED',
          message: result.message,
          data: result,
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        message: result.message,
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'error',
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/nearby-devices/beacons
   * Lists indoor beacons from the indoor mapping database
   */
  async listIndoorBeacons(req: Request, res: Response): Promise<void> {
    try {
      const { facilityId, floorLevel, facilityType } = req.query;

      const filter: {
        facilityId?: string;
        floorLevel?: number;
        facilityType?: IndoorFacilityType;
      } = {};

      if (typeof facilityId === 'string') filter.facilityId = facilityId;
      if (typeof floorLevel === 'string') filter.floorLevel = parseInt(floorLevel, 10);
      if (typeof facilityType === 'string') filter.facilityType = facilityType as IndoorFacilityType;

      const beacons = await indoorBeaconMappingService.listIndoorBeacons(filter);

      res.status(200).json({
        status: 'success',
        count: beacons.length,
        data: beacons,
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'error',
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/nearby-devices/beacons/:beaconId
   * Retrieves specific indoor beacon with exact X/Y coordinates
   */
  async getIndoorBeaconById(req: Request, res: Response): Promise<void> {
    try {
      const beaconId = Array.isArray(req.params.beaconId)
        ? req.params.beaconId[0]
        : req.params.beaconId;
      const beacon = await indoorBeaconMappingService.getIndoorBeaconById(beaconId);

      if (!beacon) {
        res.status(404).json({
          status: 'error',
          error: 'BEACON_NOT_FOUND',
          message: `Indoor beacon with ID "${beaconId}" not found in mapping database.`,
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: beacon,
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'error',
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/v1/nearby-devices/beacons
   * Admin / site survey endpoint to register or calibrate an indoor beacon
   */
  async registerIndoorBeacon(req: Request, res: Response): Promise<void> {
    try {
      const beaconData: IndoorBeaconRecord = req.body;

      if (!beaconData.beaconId || !beaconData.facilityId || beaconData.indoorX === undefined || beaconData.indoorY === undefined) {
        res.status(400).json({
          status: 'error',
          error: 'INVALID_BEACON_REGISTRATION',
          message: 'Beacon registration requires beaconId, facilityId, indoorX, indoorY, and floorLevel.',
        });
        return;
      }

      const saved = await indoorBeaconMappingService.registerIndoorBeacon(beaconData);

      res.status(201).json({
        status: 'success',
        message: 'Indoor beacon registered and calibrated successfully.',
        data: saved,
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'error',
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message,
      });
    }
  }
}

export const nearbyDevicesController = new NearbyDevicesController();
