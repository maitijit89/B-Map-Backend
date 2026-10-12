import { Request, Response } from 'express';
import { sendSuccess } from '../../core/utils/response';
import { timezoneService } from './timezone.service';

export class TimeZoneController {
  public async getTimeZone(req: Request, res: Response): Promise<void> {
    const locParam = String(req.query.location ?? '28.6129,77.2295');
    const [latStr, lngStr] = locParam.split(',');
    const lat = parseFloat(latStr) || Number(req.query.lat ?? 28.6129);
    const lng = parseFloat(lngStr) || Number(req.query.lng ?? 77.2295);

    const result = timezoneService.getTimeZone(lat, lng);
    res.json(result); // Return matching standard Google/GeoExtras Timezone JSON directly
  }
}

export const timezoneController = new TimeZoneController();
