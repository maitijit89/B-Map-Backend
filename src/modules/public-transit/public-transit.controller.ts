import { Request, Response } from 'express';
import { publicTransitService } from './public-transit.service';
import { Coordinate } from '../../core/types/geo.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class PublicTransitController {
  /**
   * Plans complete multimodal transit itinerary
   */
  async planItinerary(req: Request, res: Response): Promise<void> {
    try {
      const { origin, destination, wheelchairAccessible } = req.body;
      if (!origin || !destination) {
        sendError(res, 400, 'origin [lon, lat] and destination [lon, lat] are required');
        return;
      }

      const origCoord: Coordinate = [origin[0], origin[1]];
      const destCoord: Coordinate = [destination[0], destination[1]];

      const plan = await publicTransitService.planTransitItinerary({
        origin: origCoord,
        destination: destCoord,
        wheelchairAccessible,
      });

      sendSuccess({
        res,
        message: 'Public transit itinerary planned successfully',
        data: plan,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Retrieves live station departure board
   */
  async getDepartures(req: Request, res: Response): Promise<void> {
    try {
      const stationId = req.params.stationId as string;
      const data = await publicTransitService.getStationDepartures(stationId);

      sendSuccess({
        res,
        message: 'Station live departures retrieved',
        data,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Queries nearby transit stations
   */
  async getNearbyStations(req: Request, res: Response): Promise<void> {
    try {
      const lon = parseFloat(req.query.longitude as string);
      const lat = parseFloat(req.query.latitude as string);
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 3000;

      if (isNaN(lon) || isNaN(lat)) {
        sendError(res, 400, 'Valid longitude and latitude query parameters required');
        return;
      }

      const stations = await publicTransitService.getNearbyStations([lon, lat], radius);
      sendSuccess({
        res,
        message: 'Nearby transit stations retrieved',
        data: { count: stations.length, stations },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }
}

export const publicTransitController = new PublicTransitController();
