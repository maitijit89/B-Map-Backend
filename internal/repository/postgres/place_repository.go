package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"gorm.io/gorm"
)

type placeRepository struct {
	db *gorm.DB
}

// NewPlaceRepository initializes a new PostGIS-enabled Place repository.
func NewPlaceRepository(db *gorm.DB) domain.PlaceRepository {
	return &placeRepository{db: db}
}

func (r *placeRepository) Create(ctx context.Context, place *domain.Place) error {
	return r.db.WithContext(ctx).Create(place).Error
}

func (r *placeRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Place, error) {
	var place domain.Place
	if err := r.db.WithContext(ctx).First(&place, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrPlaceNotFound
		}
		return nil, err
	}
	return &place, nil
}

// FindWithinRadius retrieves places within radius (in meters) of a given lat/lng using PostGIS spatial indexing.
func (r *placeRepository) FindWithinRadius(ctx context.Context, lat, lng, radiusMeters float64, category string, limit, offset int) ([]domain.Place, int64, error) {
	var places []domain.Place
	var total int64

	// PostGIS spatial query using geography casting for accurate meter-based spherical distance
	pointSQL := "ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography"
	withinSQL := fmt.Sprintf("ST_DWithin(location::geography, %s, ?)", pointSQL)
	distanceSQL := fmt.Sprintf("ST_Distance(location::geography, %s) AS distance_meters", pointSQL)

	query := r.db.WithContext(ctx).Model(&domain.Place{}).
		Select("places.*, " + distanceSQL, lng, lat).
		Where(withinSQL, lng, lat, radiusMeters)

	if category != "" {
		query = query.Where("LOWER(category) = LOWER(?)", category)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if limit <= 0 {
		limit = 20
	}

	orderSQL := fmt.Sprintf("location::geography <-> ST_SetSRID(ST_MakePoint(%f, %f), 4326)::geography", lng, lat)

	err := query.
		Order(orderSQL).
		Limit(limit).
		Offset(offset).
		Find(&places).Error

	if err != nil {
		return nil, 0, err
	}

	return places, total, nil
}

// FindNearest finds the N nearest places to a coordinate.
func (r *placeRepository) FindNearest(ctx context.Context, lat, lng float64, limit int) ([]domain.Place, error) {
	var places []domain.Place
	if limit <= 0 {
		limit = 10
	}

	pointSQL := "ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography"
	distanceSQL := fmt.Sprintf("ST_Distance(location::geography, %s) AS distance_meters", pointSQL)
	orderSQL := fmt.Sprintf("location::geography <-> ST_SetSRID(ST_MakePoint(%f, %f), 4326)::geography", lng, lat)

	err := r.db.WithContext(ctx).Model(&domain.Place{}).
		Select("places.*, " + distanceSQL, lng, lat).
		Order(orderSQL).
		Limit(limit).
		Find(&places).Error

	if err != nil {
		return nil, err
	}

	return places, nil
}

func (r *placeRepository) Update(ctx context.Context, place *domain.Place) error {
	return r.db.WithContext(ctx).Save(place).Error
}

func (r *placeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&domain.Place{}, "id = ?", id).Error
}
