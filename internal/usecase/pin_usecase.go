package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
)

type pinUsecase struct {
	repo domain.PinRepository
}

func NewPinUsecase(repo domain.PinRepository) domain.PinUsecase {
	return &pinUsecase{repo: repo}
}

func (u *pinUsecase) Create(ctx context.Context, userID uuid.UUID, req *domain.PinCreate) (*domain.Pin, error) {
	pin := &domain.Pin{
		UserID: userID,
		Name:   req.Name,
		Lat:    req.Lat,
		Lng:    req.Lng,
	}

	if err := u.repo.Create(ctx, pin); err != nil {
		return nil, err
	}
	return pin, nil
}

func (u *pinUsecase) GetMyPins(ctx context.Context, userID uuid.UUID) ([]domain.Pin, error) {
	return u.repo.GetByUserID(ctx, userID)
}

func (u *pinUsecase) DeletePin(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	return u.repo.Delete(ctx, id, userID)
}
