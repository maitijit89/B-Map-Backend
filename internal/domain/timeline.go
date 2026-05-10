package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type TravelHistory struct {
	ID        uint64      `json:"id" gorm:"primaryKey"`
	UserID    uuid.UUID   `json:"user_id" gorm:"type:uuid;not null"`
	Lat       float64     `json:"lat" gorm:"-"`
	Lng       float64     `json:"lng" gorm:"-"`
	Location  interface{} `json:"-" gorm:"type:geography(Point, 4326);not null"`
	SpeedKph  float64     `json:"speed_kph" gorm:"type:decimal(5,2)"`
	CreatedAt time.Time   `json:"created_at"`
}

func (TravelHistory) TableName() string {
	return "user_timeline"
}

type TimelineRepository interface {
	Save(ctx context.Context, history *TravelHistory) error
	GetByUser(ctx context.Context, userID uuid.UUID) ([]TravelHistory, error)
}

type TimelineUsecase interface {
	RecordLocation(ctx context.Context, userID uuid.UUID, history *TravelHistory) error
	GetHistory(ctx context.Context, userID uuid.UUID) ([]TravelHistory, error)
}
