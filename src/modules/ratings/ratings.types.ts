export interface SubmitRatingRequest {
  score: number;
  feedback?: string;
  category?: string;
}

export interface Rating {
  id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  score: number;
  feedback: string;
  category: string;
  created_at: string;
}

export interface RatingStats {
  average_score: number;
  total_ratings: number;
  score_breakdown: Record<number, number>;
}
