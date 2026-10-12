import { Request, Response } from 'express';
import { sendSuccess, sendBadRequest } from '../../core/utils/response';
import { navicService } from './navic.service';

export class NavICController {
  public async processFix(req: Request, res: Response): Promise<void> {
    const { raw_latitude, raw_longitude, rawLatitude, rawLongitude, latitude, longitude, lat: qLat, lng: qLng } = req.body;
    const lat = rawLatitude ?? raw_latitude ?? latitude ?? qLat;
    const lng = rawLongitude ?? raw_longitude ?? longitude ?? qLng;

    if (lat === undefined || lng === undefined) {
      sendBadRequest(res, 'raw_latitude and raw_longitude are required');
      return;
    }

    const result = navicService.processNavICFix({
      rawLatitude: Number(lat),
      rawLongitude: Number(lng),
      rawAltitude: req.body.raw_altitude ?? req.body.rawAltitude,
      hdop: req.body.hdop,
      vdop: req.body.vdop,
      satellites: req.body.satellites,
      enableGAGAN: req.body.enable_gagan ?? req.body.enableGAGAN ?? false,
    });

    sendSuccess(res, result, 'NavIC enhanced GNSS fix computed successfully');
  }

  public async getConstellation(req: Request, res: Response): Promise<void> {
    const satellites = navicService.getConstellationStatus();
    sendSuccess(
      res,
      satellites,
      'NavIC (IRNSS) & GAGAN satellite constellation status retrieved'
    );
  }
}

export const navicController = new NavICController();
