import { Coordinate } from '../../core/types/geo.types';

export interface AspectRatings {
  cleanliness: number;     // 1 to 5
  accessibility: number;   // 1 to 5 (wheelchair ramps, elevator access)
  hospitality: number;     // 1 to 5 (staff, service quality)
  valueForMoney: number;   // 1 to 5
  amenities: number;       // 1 to 5 (restrooms, EV chargers, parking, Wi-Fi)
}

export interface SubmitPlaceRatingInput {
  placeId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  score: number;           // Overall score: 1.0 to 5.0
  title?: string;
  review?: string;
  aspects?: Partial<AspectRatings>;
  visitType?: 'solo' | 'family' | 'business' | 'couples' | 'friends';
  photos?: string[];
  tags?: string[];
  proofOfPresenceSignature?: string;
  userCoordinate?: Coordinate; // [longitude, latitude]
}

export interface IPlaceRating {
  id: string;
  placeId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  score: number;
  title?: string;
  review: string;
  aspects: AspectRatings;
  visitType: string;
  photos: string[];
  tags: string[];
  isVerifiedVisit: boolean;
  helpfulVotes: number;
  helpfulVoterIds: string[];
  reportCount: number;
  status: 'published' | 'under_review' | 'hidden';
  createdAt: string;
  updatedAt: string;
}

export interface PlaceRatingStats {
  placeId: string;
  placeName?: string;
  averageRating: number;
  totalReviews: number;
  totalRatings: number;
  verifiedVisitPercentage: number;
  recommendationPercentage: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  distributionPercentages: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  aspectAverages: AspectRatings;
  sentimentAnalysis: {
    sentiment: 'overwhelmingly_positive' | 'positive' | 'mixed' | 'negative';
    positivePercentage: number;
    topHighlights: string[];
    topCriticisms: string[];
  };
}

export interface PlaceRatingQuery {
  minScore?: number;
  maxScore?: number;
  verifiedOnly?: boolean;
  sortBy?: 'newest' | 'oldest' | 'highest' | 'lowest' | 'most_helpful';
  page?: number;
  limit?: number;
}
