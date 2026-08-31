package places

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/database"
	"gorm.io/gorm"
)

type SearchQuery struct {
	Query        string   `json:"query"`
	Latitude     *float64 `json:"latitude"`
	Longitude    *float64 `json:"longitude"`
	RadiusMeters float64  `json:"radius_meters"`
	Category     string   `json:"category"`
	Limit        int      `json:"limit"`
	Offset       int      `json:"offset"`
}

type AutocompleteItem struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Address   string    `json:"address"`
	Category  string    `json:"category"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
}

type Service interface {
	Search(ctx context.Context, q *SearchQuery) ([]domain.Place, int64, error)
	Autocomplete(ctx context.Context, prefix string, lat, lng *float64, limit int) ([]AutocompleteItem, error)
	ReverseGeocode(ctx context.Context, lat, lng float64) (*domain.Place, error)
	CreatePlace(ctx context.Context, place *domain.Place) error
}

type placesService struct {
	db *gorm.DB
}

func NewPlacesService(db *gorm.DB) Service {
	return &placesService{db: db}
}

func (s *placesService) Search(ctx context.Context, q *SearchQuery) ([]domain.Place, int64, error) {
	var places []domain.Place
	var total int64

	dbQuery := s.db.WithContext(ctx).Model(&domain.Place{})

	// Text matching
	if q.Query != "" {
		searchTerm := "%" + strings.ToLower(strings.TrimSpace(q.Query)) + "%"
		dbQuery = dbQuery.Where("(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(address) LIKE ?)", searchTerm, searchTerm, searchTerm)
	}

	if q.Category != "" {
		dbQuery = dbQuery.Where("LOWER(category) = LOWER(?)", q.Category)
	}

	// Spatial distance calculation and filtering if coordinates provided
	if q.Latitude != nil && q.Longitude != nil {
		lat := *q.Latitude
		lng := *q.Longitude

		pointSQL := "ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography"
		distanceSQL := fmt.Sprintf("ST_Distance(location::geography, %s) AS distance_meters", pointSQL)

		if q.RadiusMeters > 0 {
			withinSQL := fmt.Sprintf("ST_DWithin(location::geography, %s, ?)", pointSQL)
			dbQuery = dbQuery.Where(withinSQL, lng, lat, q.RadiusMeters)
		}

		dbQuery = dbQuery.Select("places.*, " + distanceSQL, lng, lat)
		orderSQL := fmt.Sprintf("location::geography <-> ST_SetSRID(ST_MakePoint(%f, %f), 4326)::geography", lng, lat)
		dbQuery = dbQuery.Order(orderSQL)
	}

	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}

	if err := dbQuery.Limit(limit).Offset(q.Offset).Find(&places).Error; err != nil {
		return nil, 0, err
	}

	return places, total, nil
}

func (s *placesService) Autocomplete(ctx context.Context, prefix string, lat, lng *float64, limit int) ([]AutocompleteItem, error) {
	if limit <= 0 {
		limit = 8
	}

	var places []domain.Place
	prefixMatch := strings.ToLower(strings.TrimSpace(prefix)) + "%"

	query := s.db.WithContext(ctx).Model(&domain.Place{}).
		Where("LOWER(name) LIKE ? OR LOWER(address) LIKE ?", prefixMatch, prefixMatch)

	if lat != nil && lng != nil {
		orderSQL := fmt.Sprintf("location::geography <-> ST_SetSRID(ST_MakePoint(%f, %f), 4326)::geography", *lng, *lat)
		query = query.Order(orderSQL)
	}

	if err := query.Limit(limit).Find(&places).Error; err != nil {
		return nil, err
	}

	items := make([]AutocompleteItem, len(places))
	for i, p := range places {
		items[i] = AutocompleteItem{
			ID:        p.ID,
			Name:      p.Name,
			Address:   p.Address,
			Category:  p.Category,
			Latitude:  p.Location.Latitude,
			Longitude: p.Location.Longitude,
		}
	}

	return items, nil
}

func (s *placesService) ReverseGeocode(ctx context.Context, lat, lng float64) (*domain.Place, error) {
	var place domain.Place

	pointSQL := "ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography"
	distanceSQL := fmt.Sprintf("ST_Distance(location::geography, %s) AS distance_meters", pointSQL)
	orderSQL := fmt.Sprintf("location::geography <-> ST_SetSRID(ST_MakePoint(%f, %f), 4326)::geography", lng, lat)

	err := s.db.WithContext(ctx).Model(&domain.Place{}).
		Select("places.*, " + distanceSQL, lng, lat).
		Order(orderSQL).
		First(&place).Error

	if err != nil {
		return nil, err
	}

	return &place, nil
}

func (s *placesService) CreatePlace(ctx context.Context, place *domain.Place) error {
	if place.Location.Latitude == 0 && place.Location.Longitude == 0 {
		return domain.ErrInvalidLocationPoint
	}
	return s.db.WithContext(ctx).Create(place).Error
}

// Ensure database GeoPoint compatibility
var _ database.GeoPoint
