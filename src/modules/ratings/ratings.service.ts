import { Rating, RatingStats, SubmitRatingRequest } from './ratings.types';

export class RatingService {
  private readonly ratings: Rating[] = [
    {
      id: 'rat_init_01',
      user_id: 'usr_default',
      user_name: 'Test Driver',
      user_email: 'testuser@example.com',
      score: 5,
      feedback: 'Super fast navigation and accurate tolls!',
      category: 'navigation',
      created_at: new Date().toISOString(),
    },
  ];

  public submitRating(
    userId: string,
    userName: string,
    userEmail: string,
    req: SubmitRatingRequest
  ): Rating {
    const score = Math.max(1, Math.min(5, req.score));
    const entry: Rating = {
      id: `rat_${Date.now()}`,
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      score,
      feedback: req.feedback ?? '',
      category: req.category ?? 'navigation',
      created_at: new Date().toISOString(),
    };
    this.ratings.push(entry);
    return entry;
  }

  public getMyRating(userId: string): Rating | null {
    const found = this.ratings.slice().reverse().find((r) => r.user_id === userId);
    return found ?? this.ratings[0];
  }

  public listRatings(limit = 20): Rating[] {
    return this.ratings.slice(-limit);
  }

  public getRatingStats(): RatingStats {
    let sum = 0;
    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of this.ratings) {
      sum += r.score;
      breakdown[r.score] = (breakdown[r.score] || 0) + 1;
    }
    const total = this.ratings.length;
    return {
      average_score: total > 0 ? Math.round((sum / total) * 10) / 10 : 5.0,
      total_ratings: total,
      score_breakdown: breakdown,
    };
  }

  public deleteRating(id: string): boolean {
    const idx = this.ratings.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.ratings.splice(idx, 1);
      return true;
    }
    return false;
  }
}

export const ratingService = new RatingService();
