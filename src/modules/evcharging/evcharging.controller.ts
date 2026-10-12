import { Request, Response } from 'express';
import { sendSuccess, sendNotFound } from '../../core/utils/response';
import { evService } from './evcharging.service';

export class EVController {
  public async getStations(req: Request, res: Response): Promise<void> {
    const lat = Number(req.query.lat ?? req.query.latitude ?? 28.6129);
    const lng = Number(req.query.lng ?? req.query.longitude ?? 77.2295);
    const radius = Number(req.query.radius_km ?? req.query.radius ?? 50.0);
    const connector = req.query.connector as string | undefined;

    const stations = evService.getNearbyStations({
      latitude: lat,
      longitude: lng,
      radius_km: radius,
      connector_filter: connector,
    });
    sendSuccess(res, stations, 'Nearby EV charging stations and live plug availability retrieved');
  }

  public async getStationById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const station = evService.getStationById(String(id));
    if (!station) {
      sendNotFound(res, `EV charging station '${id}' not found`);
      return;
    }
    sendSuccess(res, station, 'EV charging station details retrieved');
  }
}

export const evController = new EVController();
