import { Request, Response } from 'express';
import { sendSuccess } from '../../core/utils/response';
import { boundaryService } from './boundaries.service';

export class BoundaryController {
  public async getTerritorial(req: Request, res: Response): Promise<void> {
    const locale = String(req.query.locale ?? 'IN');
    const adminLevel = Number(req.query.admin_level ?? 0);
    const data = boundaryService.getTerritorialBorders(locale, adminLevel);
    sendSuccess(res, data, 'Survey of India (SOI) territorial borders GeoJSON retrieved');
  }

  public async getRegionHighlight(req: Request, res: Response): Promise<void> {
    const q = String(req.query.q ?? req.query.query ?? 'Delhi');
    const locale = String(req.query.locale ?? 'IN');
    const highlight = boundaryService.getRegionHighlight(q, locale);
    sendSuccess(res, highlight, 'Region boundary highlight and inverted mask retrieved');
  }
}

export const boundaryController = new BoundaryController();
