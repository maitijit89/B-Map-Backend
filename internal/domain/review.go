package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Review struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	PlaceID   string    `json:"place_id" gorm:"index;not null"`
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid;not null"`
	Rating    float64   `json:"rating" gorm:"type:decimal(2,1);not null"`
	Comment   string    `json:"comment" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	
	// Preload User details if needed
	User User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type ReviewRepository interface {
	Create(ctx context.Context, review *Review) error
	GetByPlaceID(ctx context.Context, placeID string) ([]Review, error)
	GetByUserID(ctx context.Context, userID uuid.UUID) ([]Review, error)
}

type ReviewUsecase interface {
	PostReview(ctx context.Context, review *Review) error
	GetPlaceReviews(ctx context.Context, placeID string) ([]Review, error)
	GetMyReviews(ctx context.Context, userID uuid.UUID) ([]Review, error)
}
