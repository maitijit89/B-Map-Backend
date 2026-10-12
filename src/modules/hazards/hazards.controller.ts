import { Request, Response } from 'express';
import { sendSuccess } from '../../core/utils/response';
import { hazardService } from './hazards.service';

export class HazardController {
  public async getAheadHazards(req: Request, res: Response): Promise<void> {
    const lat = Number(req.query.lat ?? req.query.latitude ?? 28.6129);
    const lng = Number(req.query.lng ?? req.query.longitude ?? 77.2295);
    const lookahead = Number(req.query.lookahead ?? req.query.lookahead_meters ?? 1500.0);

    const list = hazardService.getAheadHazards({
      latitude: lat,
      longitude: lng,
      lookaheadMeters: lookahead,
    });
    sendSuccess(res, list, 'Upcoming road hazards and speed breakers retrieved');
  }

  public async reportHazard(req: Request, res: Response): Promise<void> {
    const saved = hazardService.reportHazard(req.body);
    sendSuccess(res, saved, 'Hazard reported and queued for consensus verification', 201);
  }
}

export const hazardController = new HazardController();
