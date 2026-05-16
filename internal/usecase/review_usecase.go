package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
)

type reviewUsecase struct {
	reviewRepo domain.ReviewRepository
}

func NewReviewUsecase(reviewRepo domain.ReviewRepository) domain.ReviewUsecase {
	return &reviewUsecase{reviewRepo: reviewRepo}
}

func (u *reviewUsecase) PostReview(ctx context.Context, review *domain.Review) error {
	return u.reviewRepo.Create(ctx, review)
}

func (u *reviewUsecase) GetPlaceReviews(ctx context.Context, placeID string) ([]domain.Review, error) {
	return u.reviewRepo.GetByPlaceID(ctx, placeID)
}

func (u *reviewUsecase) GetMyReviews(ctx context.Context, userID uuid.UUID) ([]domain.Review, error) {
	return u.reviewRepo.GetByUserID(ctx, userID)
}
