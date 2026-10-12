import { Request, Response } from 'express';
import { sendSuccess } from '../../core/utils/response';
import { obfuscationService } from './obfuscation.service';

export class ObfuscationController {
  public async transform(req: Request, res: Response): Promise<void> {
    const result = obfuscationService.transformCoordinates(req.body);
    sendSuccess(res, result, 'Geospatial coordinate datum transformed');
  }

  public async fuzz(req: Request, res: Response): Promise<void> {
    const result = obfuscationService.applyPrivacyFuzz(req.body);
    sendSuccess(res, result, 'Differential privacy Laplace coordinate fuzzing applied');
  }
}

export const obfuscationController = new ObfuscationController();
