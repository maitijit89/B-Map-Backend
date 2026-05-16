package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
)

type listUsecase struct {
	listRepo domain.ListRepository
}

func NewListUsecase(listRepo domain.ListRepository) domain.ListUsecase {
	return &listUsecase{listRepo: listRepo}
}

func (u *listUsecase) CreateList(ctx context.Context, userID uuid.UUID, name string) (*domain.UserList, error) {
	list := &domain.UserList{
		ID:     uuid.New(),
		UserID: userID,
		Name:   name,
	}
	if err := u.listRepo.Create(ctx, list); err != nil {
		return nil, err
	}
	return list, nil
}

func (u *listUsecase) GetUserLists(ctx context.Context, userID uuid.UUID) ([]domain.UserList, error) {
	return u.listRepo.GetByUserID(ctx, userID)
}

func (u *listUsecase) AddPlaceToList(ctx context.Context, listID uuid.UUID, placeID string) error {
	return u.listRepo.AddPlaceToList(ctx, listID, placeID)
}
