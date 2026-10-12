import { Request, Response } from 'express';
import { sendSuccess } from '../../core/utils/response';
import { ratingService } from './ratings.service';

export class RatingController {
  public async submitRating(req: Request, res: Response): Promise<void> {
    const user = (req as any).user;
    const userId = user?.userId ?? user?.id ?? 'usr_current';
    const userName = user?.name ?? 'Authenticated User';
    const userEmail = user?.email ?? 'user@example.com';

    const rating = ratingService.submitRating(userId, userName, userEmail, req.body);
    sendSuccess(res, rating, 'Rating and review submitted successfully', 201);
  }

  public async getMyRating(req: Request, res: Response): Promise<void> {
    const user = (req as any).user;
    const userId = user?.userId ?? user?.id ?? 'usr_current';
    const rating = ratingService.getMyRating(userId);
    sendSuccess(res, rating, 'Current user rating retrieved');
  }

  public async getStats(req: Request, res: Response): Promise<void> {
    const stats = ratingService.getRatingStats();
    sendSuccess(res, stats, 'Aggregated rating statistics retrieved');
  }

  public async listRatings(req: Request, res: Response): Promise<void> {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const list = ratingService.listRatings(limit);
    sendSuccess(res, list, 'Ratings list retrieved');
  }
}

export const ratingController = new RatingController();
