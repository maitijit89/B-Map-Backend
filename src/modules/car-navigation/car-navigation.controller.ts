import { Request, Response } from 'express';
import { carNavigationService } from './car-navigation.service';
import { Coordinate } from '../../core/types/geo.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class CarNavigationController {
  /**
   * Plans car route with multi-strategy alternatives and comparison matrix
   */
  async planCarRoute(req: Request, res: Response): Promise<void> {
    try {
      const { origin, destination, strategy, isElectricVehicle } = req.body;
      if (!origin || !destination) {
        sendError(res, 400, 'origin [lon, lat] and destination [lon, lat] are required');
        return;
      }

      const origCoord: Coordinate = [origin[0], origin[1]];
      const destCoord: Coordinate = [destination[0], destination[1]];

      const plan = await carNavigationService.planCarRoute({
        origin: origCoord,
        destination: destCoord,
        strategy,
        isElectricVehicle,
      });

      sendSuccess({
        res,
        message: 'Car route and alternatives planned successfully',
        data: plan,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Solves multi-stop waypoint TSP optimization
   */
  async optimizeMultiStop(req: Request, res: Response): Promise<void> {
    try {
      const { origin, stops, destination } = req.body;
      if (!origin || !stops || !Array.isArray(stops) || stops.length === 0) {
        sendError(res, 400, 'origin and non-empty stops array are required');
        return;
      }

      const origCoord: Coordinate = [origin[0], origin[1]];
      const destCoord: Coordinate | undefined = destination ? [destination[0], destination[1]] : undefined;

      const plan = await carNavigationService.optimizeMultiStopRoute({
        origin: origCoord,
        stops,
        destination: destCoord,
      });

      sendSuccess({
        res,
        message: 'Multi-stop delivery / errand route optimized',
        data: plan,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Queries nearby speed and red-light cameras
   */
  async getNearbyCameras(req: Request, res: Response): Promise<void> {
    try {
      const lon = parseFloat(req.query.longitude as string);
      const lat = parseFloat(req.query.latitude as string);
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 3000;

      if (isNaN(lon) || isNaN(lat)) {
        sendError(res, 400, 'Valid longitude and latitude query parameters required');
        return;
      }

      const cameras = await carNavigationService.getNearbySpeedCameras([lon, lat], radius);
      sendSuccess({
        res,
        message: 'Nearby speed cameras retrieved',
        data: { count: cameras.length, cameras },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }
}

export const carNavigationController = new CarNavigationController();
