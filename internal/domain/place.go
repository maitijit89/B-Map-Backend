package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Place struct {
	ID         uuid.UUID   `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ExternalID string      `json:"external_id" gorm:"unique"`
	Name       string      `json:"name" gorm:"not null"`
	Address    string      `json:"address"`
	Lat        float64     `json:"lat" gorm:"-"`
	Lng        float64     `json:"lng" gorm:"-"`
	Location   interface{} `json:"-" gorm:"type:geography(Point, 4326);not null"`
	Category   string      `json:"category"`
	Rating     float64     `json:"rating" gorm:"type:decimal(2,1)"`
	CreatedAt  time.Time   `json:"created_at"`
}

type UserFavorite struct {
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid;primaryKey"`
	PlaceID   uuid.UUID `json:"place_id" gorm:"type:uuid;primaryKey"`
	CreatedAt time.Time `json:"created_at"`
}

func (UserFavorite) TableName() string {
	return "user_favorites"
}

type PlaceSearchQuery struct {
	Text string  `query:"text"`
	Lat  float64 `query:"lat"`
	Lng  float64 `query:"lng"`
}

type PlaceRepository interface {
	Save(ctx context.Context, place *Place) error
	GetByID(ctx context.Context, id string) (*Place, error)
	SearchLocal(ctx context.Context, query *PlaceSearchQuery) ([]Place, error)
	AddFavorite(ctx context.Context, userID, placeID uuid.UUID) error
	GetFavorites(ctx context.Context, userID uuid.UUID) ([]Place, error)
}

type PlaceUsecase interface {
	Search(ctx context.Context, query *PlaceSearchQuery) ([]Place, error)
	GetDetails(ctx context.Context, id string) (*Place, error)
	FavoritePlace(ctx context.Context, userID, placeID uuid.UUID) error
	GetFavorites(ctx context.Context, userID uuid.UUID) ([]Place, error)
}
