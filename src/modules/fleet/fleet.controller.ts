import { Request, Response } from 'express';
import { sendSuccess, sendBadRequest } from '../../core/utils/response';
import { fleetService } from './fleet.service';

export class FleetController {
  public async updateLocation(req: Request, res: Response): Promise<void> {
    const { driver_id, latitude, longitude, heading, speed_kmh } = req.body;
    if (!driver_id || latitude === undefined || longitude === undefined) {
      sendBadRequest(res, 'driver_id, latitude, and longitude are required');
      return;
    }

    const updated = fleetService.updateDriverLocation({
      driver_id,
      latitude: Number(latitude),
      longitude: Number(longitude),
      heading: Number(heading ?? 0),
      speed_kmh: Number(speed_kmh ?? 0),
    });

    sendSuccess(res, updated, 'Fleet vehicle location updated');
  }

  public async getNearby(req: Request, res: Response): Promise<void> {
    const lat = Number(req.query.lat ?? req.query.latitude ?? 28.6129);
    const lng = Number(req.query.lng ?? req.query.longitude ?? 77.2295);
    const radius = Number(req.query.radius_km ?? req.query.radius ?? 5.0);

    const drivers = fleetService.getNearbyDrivers(lat, lng, radius);
    sendSuccess(res, drivers, 'Nearby fleet commercial vehicles retrieved');
  }

  public async requestTrip(req: Request, res: Response): Promise<void> {
    const trip = fleetService.requestTrip(req.body);
    sendSuccess(res, trip, 'Fleet trip requested and dispatched to nearby drivers', 201);
  }
}

export const fleetController = new FleetController();
