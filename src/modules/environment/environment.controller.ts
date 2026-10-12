import { Request, Response } from 'express';
import { sendSuccess } from '../../core/utils/response';
import { environmentService } from './environment.service';

export class EnvironmentController {
  public async getAirQuality(req: Request, res: Response): Promise<void> {
    const lat = Number(req.query.lat ?? req.query.latitude ?? 28.6129);
    const lng = Number(req.query.lng ?? req.query.longitude ?? 77.2295);
    const data = environmentService.getAirQuality(lat, lng);
    sendSuccess(res, data, 'Air quality index (AQI) retrieved');
  }

  public async getSolar(req: Request, res: Response): Promise<void> {
    const lat = Number(req.query.lat ?? req.query.latitude ?? 28.6129);
    const lng = Number(req.query.lng ?? req.query.longitude ?? 77.2295);
    const data = environmentService.getSolarPotential(lat, lng);
    sendSuccess(res, data, 'Solar potential index retrieved');
  }

  public async getPollen(req: Request, res: Response): Promise<void> {
    const lat = Number(req.query.lat ?? req.query.latitude ?? 28.6129);
    const lng = Number(req.query.lng ?? req.query.longitude ?? 77.2295);
    const data = environmentService.getPollen(lat, lng);
    sendSuccess(res, data, 'Pollen alert index retrieved');
  }
}

export const environmentController = new EnvironmentController();
