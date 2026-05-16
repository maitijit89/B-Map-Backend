package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type IncidentType string

const (
	IncidentAccident     IncidentType = "accident"
	IncidentClosure      IncidentType = "closure"
	IncidentHazard       IncidentType = "hazard"
	IncidentTraffic      IncidentType = "traffic"
	IncidentWaterlogging IncidentType = "waterlogging"
	IncidentPothole      IncidentType = "pothole"
	IncidentStrayAnimal  IncidentType = "stray_animal"
	IncidentPoliceCheck  IncidentType = "police_check"
	IncidentEvent        IncidentType = "event"
)

type IncidentSeverity string

const (
	SeverityLow      IncidentSeverity = "low"
	SeverityMedium   IncidentSeverity = "medium"
	SeverityHigh     IncidentSeverity = "high"
	SeverityCritical IncidentSeverity = "critical"
)

type Incident struct {
	ID          uuid.UUID        `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Type        IncidentType     `json:"type" gorm:"not null"`
	Severity    IncidentSeverity `json:"severity" gorm:"default:'medium'"`
	Description string           `json:"description"`
	Lat         float64          `json:"lat" gorm:"-"`
	Lng         float64          `json:"lng" gorm:"-"`
	Location    interface{}      `json:"-" gorm:"type:geography(Point, 4326);not null"`
	ReporterID  *uuid.UUID       `json:"reporter_id" gorm:"type:uuid"`
	IsActive    bool             `json:"is_active" gorm:"default:true"`
	Upvotes     int              `json:"upvotes" gorm:"default:0"`
	CreatedAt   time.Time        `json:"created_at"`
	ExpiresAt   *time.Time       `json:"expires_at"`
}

type IncidentReport struct {
	Type        IncidentType     `json:"type" validate:"required"`
	Severity    IncidentSeverity `json:"severity" validate:"required"`
	Description string           `json:"description"`
	Lat         float64          `json:"lat" validate:"required"`
	Lng         float64          `json:"lng" validate:"required"`
}

type IncidentQuery struct {
	Lat    float64 `query:"lat"`
	Lng    float64 `query:"lng"`
	Radius float64 `query:"radius"` // in meters
}

type IncidentRepository interface {
	Create(ctx context.Context, incident *Incident) error
	GetNearby(ctx context.Context, lat, lng, radius float64) ([]Incident, error)
	Upvote(ctx context.Context, id uuid.UUID) error
}

type IncidentUsecase interface {
	Report(ctx context.Context, reporterID uuid.UUID, req *IncidentReport) (*Incident, error)
	GetNearby(ctx context.Context, query *IncidentQuery) ([]Incident, error)
	Upvote(ctx context.Context, id uuid.UUID) error
}

type Hub interface {
	BroadcastIncident(incident *Incident)
}
