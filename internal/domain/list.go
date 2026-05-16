package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type UserList struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid;index;not null"`
	Name      string    `json:"name" gorm:"not null"`
	Places    []Place   `json:"places" gorm:"many2many:list_places;"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ListRepository interface {
	Create(ctx context.Context, list *UserList) error
	GetByUserID(ctx context.Context, userID uuid.UUID) ([]UserList, error)
	GetByID(ctx context.Context, id uuid.UUID) (*UserList, error)
	AddPlaceToList(ctx context.Context, listID uuid.UUID, placeID string) error
	RemovePlaceFromList(ctx context.Context, listID uuid.UUID, placeID string) error
}

type ListUsecase interface {
	CreateList(ctx context.Context, userID uuid.UUID, name string) (*UserList, error)
	GetUserLists(ctx context.Context, userID uuid.UUID) ([]UserList, error)
	AddPlaceToList(ctx context.Context, listID uuid.UUID, placeID string) error
}
