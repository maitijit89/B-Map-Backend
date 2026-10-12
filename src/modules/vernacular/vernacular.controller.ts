import { Request, Response } from 'express';
import { sendSuccess } from '../../core/utils/response';
import { vernacularService } from './vernacular.service';

export class VernacularController {
  public async translatePrompt(req: Request, res: Response): Promise<void> {
    const prompt = vernacularService.translateManeuver(req.body);
    sendSuccess(res, prompt, 'Localized Indian vernacular audio cue generated');
  }

  public async getLanguages(req: Request, res: Response): Promise<void> {
    const langs = vernacularService.getSupportedLanguages();
    sendSuccess(res, langs, 'Supported Indian vernacular languages retrieved');
  }
}

export const vernacularController = new VernacularController();
