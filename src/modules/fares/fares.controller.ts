import { Request, Response } from 'express';
import { sendSuccess } from '../../core/utils/response';
import { fareService } from './fares.service';

export class FareController {
  public async estimateFares(req: Request, res: Response): Promise<void> {
    const result = fareService.estimateFares(req.body);
    sendSuccess(res, result, 'City auto-rickshaw and regulated taxi fares estimated');
  }
}

export const fareController = new FareController();
