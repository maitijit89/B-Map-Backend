package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/pkg/database"
)

// Place represents a geographical location entity stored in MongoDB with GeoJSON 2dsphere indexing.
type Place struct {
	ID          uuid.UUID         `json:"id" bson:"_id,omitempty"`
	Name        string            `json:"name" bson:"name"`
	Description string            `json:"description" bson:"description"`
	Address     string            `json:"address" bson:"address"`
	Category    string            `json:"category" bson:"category"`
	Location    database.GeoPoint `json:"location" bson:"location"`
	PhotoURL    string            `json:"photo_url,omitempty" bson:"photo_url,omitempty"`
	CreatedBy   *uuid.UUID        `json:"created_by,omitempty" bson:"created_by,omitempty"`
	CreatedAt   time.Time         `json:"created_at" bson:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at" bson:"updated_at"`

	// Virtual field populated during spatial queries ($geoNear / Haversine)
	DistanceMeters float64 `json:"distance_meters,omitempty" bson:"distance_meters,omitempty"`
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
