package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
	"gorm.io/gorm"
)

type pinRepository struct {
	db *gorm.DB
}

func NewPinRepository(db *gorm.DB) domain.PinRepository {
	return &pinRepository{db: db}
}

func (r *pinRepository) Create(ctx context.Context, pin *domain.Pin) error {
	return r.db.WithContext(ctx).Create(pin).Error
}

func (r *pinRepository) GetByUserID(ctx context.Context, userID uuid.UUID) ([]domain.Pin, error) {
	var pins []domain.Pin
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).Find(&pins).Error
	return pins, err
}

func (r *pinRepository) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).Delete(&domain.Pin{}).Error
}
