import { Request, Response } from 'express';
import { sendSuccess, sendBadRequest } from '../../core/utils/response';
import { tollService } from './tolls.service';

export class TollController {
  public async calculateTolls(req: Request, res: Response): Promise<void> {
    const { origin, destination, vehicle_class, vehicleType, vehicle_type, is_return_trip, isReturnTrip, route_coordinates, routeCoordinates } = req.body;
    const vType = vehicleType ?? vehicle_type ?? vehicle_class;

    const result = tollService.calculateTolls({
      origin,
      destination,
      vehicleType: vType,
      isReturnTrip: isReturnTrip ?? is_return_trip,
      routeCoordinates: routeCoordinates ?? route_coordinates,
    });

    sendSuccess(res, result, 'FASTag toll calculated successfully');
  }

  public async getNearby(req: Request, res: Response): Promise<void> {
    const lat = Number(req.query.lat ?? req.query.latitude ?? 28.6129);
    const lng = Number(req.query.lng ?? req.query.longitude ?? 77.2295);
    const radius = Number(req.query.radius_km ?? req.query.radius ?? 50.0);

    const plazas = tollService.getNearbyTollPlazas(lat, lng, radius);
    sendSuccess(res, plazas, 'Nearby FASTag toll plazas retrieved');
  }
}

export const tollController = new TollController();
