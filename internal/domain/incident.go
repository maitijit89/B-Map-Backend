package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type IncidentType string

const (
	IncidentAccident IncidentType = "accident"
	IncidentClosure  IncidentType = "closure"
	IncidentHazard   IncidentType = "hazard"
	IncidentTraffic  IncidentType = "traffic"
)

type Incident struct {
	ID          uuid.UUID    `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Type        IncidentType `json:"type" gorm:"not null"`
	Description string       `json:"description"`
	Lat         float64      `json:"lat" gorm:"-"`
	Lng         float64      `json:"lng" gorm:"-"`
	Location    interface{}  `json:"-" gorm:"type:geography(Point, 4326);not null"`
	ReporterID  *uuid.UUID   `json:"reporter_id" gorm:"type:uuid"`
	IsActive    bool         `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time    `json:"created_at"`
	ExpiresAt   *time.Time   `json:"expires_at"`
}

type IncidentReport struct {
	Type        IncidentType `json:"type" validate:"required"`
	Description string       `json:"description"`
	Lat         float64      `json:"lat" validate:"required"`
	Lng         float64      `json:"lng" validate:"required"`
}

type IncidentQuery struct {
	Lat    float64 `query:"lat"`
	Lng    float64 `query:"lng"`
	Radius float64 `query:"radius"` // in meters
}

type IncidentRepository interface {
	Create(ctx context.Context, incident *Incident) error
	GetNearby(ctx context.Context, lat, lng, radius float64) ([]Incident, error)
}

type IncidentUsecase interface {
	Report(ctx context.Context, reporterID uuid.UUID, req *IncidentReport) (*Incident, error)
	GetNearby(ctx context.Context, query *IncidentQuery) ([]Incident, error)
}

type Hub interface {
	BroadcastIncident(incident *Incident)
}
