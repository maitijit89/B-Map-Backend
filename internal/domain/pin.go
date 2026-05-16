package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Pin struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid;index;not null"`
	Name      string    `json:"name" gorm:"not null"`
	Lat       float64   `json:"lat" gorm:"not null"`
	Lng       float64   `json:"lng" gorm:"not null"`
	CreatedAt time.Time `json:"created_at"`
}

type PinCreate struct {
	Name string  `json:"name" validate:"required"`
	Lat  float64 `json:"lat" validate:"required"`
	Lng  float64 `json:"lng" validate:"required"`
}

type PinRepository interface {
	Create(ctx context.Context, pin *Pin) error
	GetByUserID(ctx context.Context, userID uuid.UUID) ([]Pin, error)
	Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}

type PinUsecase interface {
	Create(ctx context.Context, userID uuid.UUID, req *PinCreate) (*Pin, error)
	GetMyPins(ctx context.Context, userID uuid.UUID) ([]Pin, error)
	DeletePin(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}
