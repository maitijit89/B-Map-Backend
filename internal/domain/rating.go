package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Rating represents an in-app review & rating from a user stored in MongoDB.
type Rating struct {
	ID        uuid.UUID `json:"id" bson:"_id,omitempty"`
	UserID    uuid.UUID `json:"user_id" bson:"user_id"`
	UserName  string    `json:"user_name" bson:"user_name"`
	UserEmail string    `json:"user_email" bson:"user_email"`
	Score     int       `json:"score" bson:"score"` // 1 to 5 stars
	Feedback  string    `json:"feedback" bson:"feedback"`
	Category  string    `json:"category" bson:"category"` // "navigation", "ui", "accuracy", "general"
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
}

// RatingStats represents aggregated metrics for all app ratings.
type RatingStats struct {
	AverageScore float64         `json:"average_score"`
	TotalRatings int64           `json:"total_ratings"`
	Distribution map[int]int64   `json:"distribution"` // e.g. {5: 120, 4: 45, 3: 10, 2: 2, 1: 1}
}

// RatingRepository defines the data access contract for Ratings.
type RatingRepository interface {
	Upsert(ctx context.Context, rating *Rating) error
	GetByUserID(ctx context.Context, userID uuid.UUID) (*Rating, error)
	List(ctx context.Context, limit, offset int64) ([]*Rating, int64, error)
	GetStats(ctx context.Context) (*RatingStats, error)
}
