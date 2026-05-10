package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
)

type timelineUsecase struct {
	repo domain.TimelineRepository
}

func NewTimelineUsecase(repo domain.TimelineRepository) domain.TimelineUsecase {
	return &timelineUsecase{repo: repo}
}

func (u *timelineUsecase) RecordLocation(ctx context.Context, userID uuid.UUID, history *domain.TravelHistory) error {
	history.UserID = userID
	history.CreatedAt = time.Now()
	return u.repo.Save(ctx, history)
}

func (u *timelineUsecase) GetHistory(ctx context.Context, userID uuid.UUID) ([]domain.TravelHistory, error) {
	return u.repo.GetByUser(ctx, userID)
}
