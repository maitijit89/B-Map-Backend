import { Request, Response } from 'express';
import { sendSuccess, sendBadRequest, sendNotFound } from '../../core/utils/response';
import { weatherService } from './weather.service';

export class WeatherController {
  public async getHighwayWeather(req: Request, res: Response): Promise<void> {
    const lat = Number(req.query.lat ?? req.query.latitude ?? 28.6129);
    const lng = Number(req.query.lng ?? req.query.longitude ?? 77.2295);
    const highway = String(req.query.highway ?? req.query.highway_name ?? 'Yamuna Expressway');

    const report = weatherService.getHighwayWeather(lat, lng, highway);
    sendSuccess(res, report, 'Highway IMD weather & radar report retrieved');
  }

  public async setOverride(req: Request, res: Response): Promise<void> {
    const { highway_name, highwayName } = req.body;
    const name = highway_name ?? highwayName;
    if (!name) {
      sendBadRequest(res, 'highway_name is required');
      return;
    }

    const saved = weatherService.setManualOverride({
      ...req.body,
      highway_name: name,
    });
    sendSuccess(res, saved, 'Weather override set successfully');
  }

  public async getOverrides(req: Request, res: Response): Promise<void> {
    const list = weatherService.getActiveOverrides();
    sendSuccess(res, list, 'Active weather overrides retrieved');
  }

  public async deleteOverride(req: Request, res: Response): Promise<void> {
    const name = String(req.params.name);
    const deleted = weatherService.deleteOverride(name);
    if (!deleted) {
      sendNotFound(res, `Override for highway '${name}' not found`);
      return;
    }
    sendSuccess(res, { deleted: true }, `Override for highway '${name}' deleted`);
  }
}

export const weatherController = new WeatherController();
