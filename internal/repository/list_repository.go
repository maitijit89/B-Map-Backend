package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
	"gorm.io/gorm"
)

type listRepository struct {
	db *gorm.DB
}

func NewListRepository(db *gorm.DB) domain.ListRepository {
	return &listRepository{db: db}
}

func (r *listRepository) Create(ctx context.Context, list *domain.UserList) error {
	return r.db.WithContext(ctx).Create(list).Error
}

func (r *listRepository) GetByUserID(ctx context.Context, userID uuid.UUID) ([]domain.UserList, error) {
	var lists []domain.UserList
	err := r.db.WithContext(ctx).
		Preload("Places").
		Where("user_id = ?", userID).
		Find(&lists).Error
	return lists, err
}

func (r *listRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.UserList, error) {
	var list domain.UserList
	err := r.db.WithContext(ctx).
		Preload("Places").
		First(&list, "id = ?", id).Error
	return &list, err
}

func (r *listRepository) AddPlaceToList(ctx context.Context, listID uuid.UUID, placeID string) error {
	// We need to ensure the place exists in our DB first or just link by place_id if it's external
	// For simplicity, we'll assume the place model stores the Google Place ID
	var place domain.Place
	if err := r.db.First(&place, "external_id = ?", placeID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create a placeholder place if not exists
			place = domain.Place{ExternalID: placeID, Name: "Unknown Place"}
			r.db.Create(&place)
		} else {
			return err
		}
	}

	return r.db.WithContext(ctx).Model(&domain.UserList{ID: listID}).Association("Places").Append(&place)
}

func (r *listRepository) RemovePlaceFromList(ctx context.Context, listID uuid.UUID, placeID string) error {
	var place domain.Place
	if err := r.db.First(&place, "external_id = ?", placeID).Error; err != nil {
		return err
	}
	return r.db.WithContext(ctx).Model(&domain.UserList{ID: listID}).Association("Places").Delete(&place)
}
