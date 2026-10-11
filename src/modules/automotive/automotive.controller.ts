import { Request, Response } from 'express';
import { automotiveEcosystemService } from './automotive-ecosystem.service';
import { Coordinate } from '../../core/types/geo.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class AutomotiveController {
  /**
   * Generates Apple CarPlay NavigationTemplate payload
   */
  async getCarPlayTemplate(req: Request, res: Response): Promise<void> {
    try {
      const {
        remainingDistanceMeters,
        remainingDurationSeconds,
        currentSpeedKmh,
        speedLimitKmh,
        nextTurnInstruction,
        nextTurnSymbol,
        isNightMode,
      } = req.body;

      if (remainingDistanceMeters === undefined || remainingDurationSeconds === undefined) {
        sendError(res, 400, 'remainingDistanceMeters and remainingDurationSeconds are required');
        return;
      }

      const template = automotiveEcosystemService.generateCarPlayTemplate({
        remainingDistanceMeters,
        remainingDurationSeconds,
        currentSpeedKmh: currentSpeedKmh ?? 50,
        speedLimitKmh,
        nextTurnInstruction: nextTurnInstruction || 'Continue straight',
        nextTurnSymbol,
        isNightMode,
      });

      sendSuccess({
        res,
        message: 'Apple CarPlay navigation template generated successfully',
        data: template,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Generates Android Auto NavigationTemplate for Cars App Library
   */
  async getAndroidAutoTemplate(req: Request, res: Response): Promise<void> {
    try {
      const {
        stepTitle,
        stepDescription,
        remainingDistanceMeters,
        remainingDurationSeconds,
        recommendedLanes,
        isSplitScreen,
      } = req.body;

      if (remainingDistanceMeters === undefined || remainingDurationSeconds === undefined) {
        sendError(res, 400, 'remainingDistanceMeters and remainingDurationSeconds are required');
        return;
      }

      const template = automotiveEcosystemService.generateAndroidAutoTemplate({
        stepTitle: stepTitle || 'Proceed on Route',
        stepDescription: stepDescription || 'Follow highway signs',
        remainingDistanceMeters,
        remainingDurationSeconds,
        recommendedLanes,
        isSplitScreen,
      });

      sendSuccess({
        res,
        message: 'Android Auto navigation template generated successfully',
        data: template,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Ingests native AAOS CarPropertyManager / VHAL updates
   */
  async updateAAOSProperties(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId, properties } = req.body;
      if (!vehicleId || !properties) {
        sendError(res, 400, 'vehicleId and properties object are required');
        return;
      }

      const updatedState = automotiveEcosystemService.updateAAOSVehicleState(vehicleId, properties);
      sendSuccess({
        res,
        message: 'AAOS vehicle properties updated successfully',
        data: updatedState,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Ingests CAN Bus / OBD-II telemetry and evaluates Eco-Driving score
   */
  async ingestCANTelemetry(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId, packet } = req.body;
      if (!vehicleId || !packet) {
        sendError(res, 400, 'vehicleId and packet are required');
        return;
      }

      const ecoScore = automotiveEcosystemService.processCANTelemetry(vehicleId, packet);
      sendSuccess({
        res,
        message: 'CAN Bus telemetry ingested and eco score computed',
        data: ecoScore,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Plans Smart EV route with charging stops and battery pre-conditioning
   */
  async planEVRoute(req: Request, res: Response): Promise<void> {
    try {
      const { origin, destination, vehicleProfile, initialSocPercent } = req.body;
      if (!origin || !destination) {
        sendError(res, 400, 'origin [lon, lat] and destination [lon, lat] are required');
        return;
      }

      const origCoord: Coordinate = [origin[0], origin[1]];
      const destCoord: Coordinate = [destination[0], destination[1]];

      const plan = automotiveEcosystemService.planEVChargingRoute({
        origin: origCoord,
        destination: destCoord,
        vehicleProfile,
        initialSocPercent: initialSocPercent ?? 85,
      });

      sendSuccess({
        res,
        message: 'EV smart route calculated successfully',
        data: plan,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Generates compact Smart Heads-Up Display (HUD) frame with binary hex payload
   */
  async getHUDFrame(req: Request, res: Response): Promise<void> {
    try {
      const {
        maneuverCode,
        maneuverSymbol,
        distancePercent,
        targetLaneBitmask,
        vehicleSpeedKmh,
        speedLimitKmh,
        adasWarningCode,
      } = req.body;

      const frame = automotiveEcosystemService.generateHUDFrame({
        maneuverCode: maneuverCode ?? 1,
        maneuverSymbol: maneuverSymbol ?? 'turn.left',
        distancePercent: distancePercent ?? 50,
        targetLaneBitmask: targetLaneBitmask ?? 1,
        vehicleSpeedKmh: vehicleSpeedKmh ?? 50,
        speedLimitKmh: speedLimitKmh ?? 50,
        adasWarningCode,
      });

      sendSuccess({
        res,
        message: 'Smart HUD frame generated successfully',
        data: frame,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }
}

export const automotiveController = new AutomotiveController();
