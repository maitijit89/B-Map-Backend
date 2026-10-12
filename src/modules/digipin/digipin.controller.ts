import { Request, Response } from 'express';
import { sendSuccess, sendBadRequest } from '../../core/utils/response';
import { digipinService } from './digipin.service';

export class DIGIPINController {
  public async encode(req: Request, res: Response): Promise<void> {
    const lat = req.query.lat ?? req.query.latitude;
    const lng = req.query.lng ?? req.query.longitude;

    if (lat === undefined || lng === undefined) {
      sendBadRequest(res, 'lat and lng query parameters are required');
      return;
    }

    const result = digipinService.encodeCoordinates(Number(lat), Number(lng));
    sendSuccess(res, result, 'Coordinates encoded into DIGIPIN micro-grid');
  }

  public async decode(req: Request, res: Response): Promise<void> {
    const { code } = req.params;
    if (!code) {
      sendBadRequest(res, 'DIGIPIN code is required');
      return;
    }

    const result = digipinService.decodeDIGIPIN(String(code));
    sendSuccess(res, result, 'DIGIPIN decoded into geographic coordinates');
  }
}

export const digipinController = new DIGIPINController();
