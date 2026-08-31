package rating

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
)

type SubmitRatingRequest struct {
	Score    int    `json:"score" binding:"required,min=1,max=5"`
	Feedback string `json:"feedback"`
	Category string `json:"category"` // "navigation", "ui", "performance", "general"
}

type Service interface {
	SubmitRating(ctx context.Context, userID uuid.UUID, userName, userEmail string, req *SubmitRatingRequest) (*domain.Rating, error)
	GetMyRating(ctx context.Context, userID uuid.UUID) (*domain.Rating, error)
	ListRatings(ctx context.Context, limit, offset int64) ([]*domain.Rating, int64, error)
	GetRatingStats(ctx context.Context) (*domain.RatingStats, error)
}

type ratingService struct {
	repo domain.RatingRepository
}

func NewRatingService(repo domain.RatingRepository) Service {
	return &ratingService{repo: repo}
}

func (s *ratingService) SubmitRating(ctx context.Context, userID uuid.UUID, userName, userEmail string, req *SubmitRatingRequest) (*domain.Rating, error) {
	if req.Score < 1 || req.Score > 5 {
		return nil, errors.New("rating score must be between 1 and 5 stars")
	}

	category := req.Category
	if category == "" {
		category = "general"
	}

	r := &domain.Rating{
		ID:        uuid.New(),
		UserID:    userID,
		UserName:  userName,
		UserEmail: userEmail,
		Score:     req.Score,
		Feedback:  req.Feedback,
		Category:  category,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}

	if err := s.repo.Upsert(ctx, r); err != nil {
		return nil, err
	}

	return r, nil
}

func (s *ratingService) GetMyRating(ctx context.Context, userID uuid.UUID) (*domain.Rating, error) {
	return s.repo.GetByUserID(ctx, userID)
}

func (s *ratingService) ListRatings(ctx context.Context, limit, offset int64) ([]*domain.Rating, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.List(ctx, limit, offset)
}

func (s *ratingService) GetRatingStats(ctx context.Context) (*domain.RatingStats, error) {
	return s.repo.GetStats(ctx)
}
