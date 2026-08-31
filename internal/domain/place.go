package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/pkg/database"
)

// Place represents a geographical location entity stored in PostgreSQL/PostGIS.
type Place struct {
	ID          uuid.UUID         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name        string            `gorm:"type:varchar(255);not null;index" json:"name"`
	Description string            `gorm:"type:text" json:"description"`
	Address     string            `gorm:"type:varchar(512)" json:"address"`
	Category    string            `gorm:"type:varchar(100);index" json:"category"`
	Location    database.GeoPoint `gorm:"type:geometry(Point,4326);not null;index:idx_places_location,type:gist" json:"location"`
	PhotoURL    string            `gorm:"type:varchar(512)" json:"photo_url,omitempty"`
	CreatedBy   *uuid.UUID        `gorm:"type:uuid" json:"created_by,omitempty"`
	CreatedAt   time.Time         `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time         `gorm:"autoUpdateTime" json:"updated_at"`

	// Virtual fields populated during spatial queries
	DistanceMeters float64 `gorm:"->;-:migration" json:"distance_meters,omitempty"`
}

// PlaceRepository defines the database access methods for Place entities.
type PlaceRepository interface {
	Create(ctx context.Context, place *Place) error
	GetByID(ctx context.Context, id uuid.UUID) (*Place, error)
	FindWithinRadius(ctx context.Context, lat, lng, radiusMeters float64, category string, limit, offset int) ([]Place, int64, error)
	FindNearest(ctx context.Context, lat, lng float64, limit int) ([]Place, error)
	Update(ctx context.Context, place *Place) error
	Delete(ctx context.Context, id uuid.UUID) error
}

// CreatePlaceRequest is the DTO for creating a new place.
type CreatePlaceRequest struct {
	Name        string  `json:"name" validate:"required,min=2,max=255"`
	Description string  `json:"description" validate:"max=2000"`
	Address     string  `json:"address" validate:"required,max=512"`
	Category    string  `json:"category" validate:"required,max=100"`
	Latitude    float64 `json:"latitude" validate:"required,latitude"`
	Longitude   float64 `json:"longitude" validate:"required,longitude"`
	PhotoURL    string  `json:"photo_url" validate:"omitempty,url"`
}

// NearbyPlacesQuery represents the query parameters for spatial search.
type NearbyPlacesQuery struct {
	Latitude     float64 `query:"lat" validate:"required,latitude"`
	Longitude    float64 `query:"lng" validate:"required,longitude"`
	RadiusMeters float64 `query:"radius" validate:"required,min=10,max=100000"` // Max 100km
	Category     string  `query:"category"`
	Limit        int     `query:"limit" validate:"omitempty,min=1,max=100"`
	Offset       int     `query:"offset" validate:"omitempty,min=0"`
}
