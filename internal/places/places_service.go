package places

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/cache"
	"github.com/maitijit89/b-map-backend/pkg/database"
	"github.com/maitijit89/b-map-backend/pkg/utils"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
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
	coll    *mongo.Collection
	l1Cache *cache.LRUCache
}

func NewPlacesService(db *mongo.Database) Service {
	var coll *mongo.Collection
	if db != nil {
		coll = db.Collection("places")
	}
	return &placesService{
		coll:    coll,
		l1Cache: cache.NewLRUCache(2000, 5*time.Minute),
	}
}

func (s *placesService) Search(ctx context.Context, q *SearchQuery) ([]domain.Place, int64, error) {
	if s.coll == nil {
		return nil, 0, errors.New("database not connected")
	}

	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := q.Offset
	if offset < 0 {
		offset = 0
	}

	filter := bson.M{}

	// Text query search matching name, description, or address
	if trimmedQuery := strings.TrimSpace(q.Query); trimmedQuery != "" {
		escaped := regexp.QuoteMeta(trimmedQuery)
		filter["$or"] = []bson.M{
			{"name": bson.M{"$regex": escaped, "$options": "i"}},
			{"description": bson.M{"$regex": escaped, "$options": "i"}},
			{"address": bson.M{"$regex": escaped, "$options": "i"}},
		}
	}

	// Category filter
	if trimmedCat := strings.TrimSpace(q.Category); trimmedCat != "" {
		filter["category"] = bson.M{
			"$regex":   "^" + regexp.QuoteMeta(trimmedCat) + "$",
			"$options": "i",
		}
	}

	// Spatial search if coordinates provided
	if q.Latitude != nil && q.Longitude != nil {
		lat := *q.Latitude
		lng := *q.Longitude

		geoNearDoc := bson.D{
			{Key: "near", Value: bson.D{
				{Key: "type", Value: "Point"},
				{Key: "coordinates", Value: bson.A{lng, lat}},
			}},
			{Key: "distanceField", Value: "distance_meters"},
			{Key: "spherical", Value: true},
		}

		if q.RadiusMeters > 0 {
			geoNearDoc = append(geoNearDoc, bson.E{Key: "maxDistance", Value: q.RadiusMeters})
		}
		if len(filter) > 0 {
			geoNearDoc = append(geoNearDoc, bson.E{Key: "query", Value: filter})
		}

		pipeline := mongo.Pipeline{
			{{Key: "$geoNear", Value: geoNearDoc}},
			{{Key: "$facet", Value: bson.M{
				"metadata": []bson.M{{"$count": "total"}},
				"data":     []bson.M{{"$skip": offset}, {"$limit": limit}},
			}}},
		}

		cursor, err := s.coll.Aggregate(ctx, pipeline)
		if err == nil {
			defer cursor.Close(ctx)

			type FacetResult struct {
				Metadata []struct {
					Total int64 `bson:"total"`
				} `bson:"metadata"`
				Data []domain.Place `bson:"data"`
			}

			var results []FacetResult
			if err := cursor.All(ctx, &results); err == nil && len(results) > 0 {
				var total int64
				if len(results[0].Metadata) > 0 {
					total = results[0].Metadata[0].Total
				}
				places := results[0].Data
				if places == nil {
					places = []domain.Place{}
				}
				return places, total, nil
			}
		}

		// Fallback if $geoNear aggregation is not supported on current topology
		if q.RadiusMeters > 0 {
			radiusRadians := q.RadiusMeters / 6378137.0
			filter["location"] = bson.M{
				"$geoWithin": bson.M{
					"$centerSphere": bson.A{bson.A{lng, lat}, radiusRadians},
				},
			}
		}
	}

	total, err := s.coll.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	findOpts := options.Find().
		SetLimit(int64(limit)).
		SetSkip(int64(offset)).
		SetSort(bson.D{{Key: "created_at", Value: -1}})

	cursor, err := s.coll.Find(ctx, filter, findOpts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var places []domain.Place
	if err := cursor.All(ctx, &places); err != nil {
		return nil, 0, err
	}

	if q.Latitude != nil && q.Longitude != nil {
		lat := *q.Latitude
		lng := *q.Longitude
		for i := range places {
			places[i].DistanceMeters = math.Round(utils.HaversineDistance(lat, lng, places[i].Location.Latitude, places[i].Location.Longitude)*10) / 10
		}
	}

	return places, total, nil
}

func (s *placesService) Autocomplete(ctx context.Context, prefix string, lat, lng *float64, limit int) ([]AutocompleteItem, error) {
	if limit <= 0 {
		limit = 8
	}

	trimmed := strings.TrimSpace(prefix)
	latKey := "nil"
	lngKey := "nil"
	if lat != nil {
		latKey = fmt.Sprintf("%.4f", *lat)
	}
	if lng != nil {
		lngKey = fmt.Sprintf("%.4f", *lng)
	}
	cacheKey := fmt.Sprintf("places:auto:%s:%s:%s:%d", strings.ToLower(trimmed), latKey, lngKey, limit)
	if s.l1Cache != nil {
		if val, found := s.l1Cache.Get(cacheKey); found {
			if cachedItems, ok := val.([]AutocompleteItem); ok {
				return cachedItems, nil
			}
		}
	}

	if s.coll == nil {
		return nil, errors.New("database not connected")
	}

	escaped := regexp.QuoteMeta(trimmed)

	filter := bson.M{
		"$or": []bson.M{
			{"name": bson.M{"$regex": "(?i)^" + escaped}},
			{"address": bson.M{"$regex": "(?i)^" + escaped}},
			{"name": bson.M{"$regex": "(?i)" + escaped}},
		},
	}

	findOpts := options.Find().
		SetLimit(int64(limit)).
		SetProjection(bson.M{
			"_id":      1,
			"name":     1,
			"address":  1,
			"category": 1,
			"location": 1,
		})

	if lat != nil && lng != nil {
		// Use $nearSphere when coordinates are provided to prioritize proximity
		filter["location"] = bson.M{
			"$nearSphere": bson.M{
				"$geometry": bson.M{
					"type":        "Point",
					"coordinates": bson.A{*lng, *lat},
				},
			},
		}
	}

	cursor, err := s.coll.Find(ctx, filter, findOpts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var places []domain.Place
	if err := cursor.All(ctx, &places); err != nil {
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

	if s.l1Cache != nil {
		s.l1Cache.Set(cacheKey, items)
	}

	return items, nil
}

func (s *placesService) ReverseGeocode(ctx context.Context, lat, lng float64) (*domain.Place, error) {
	if s.coll == nil {
		return nil, errors.New("database not connected")
	}

	// Try $geoNear aggregation first to fetch nearest place and compute distance
	pipeline := mongo.Pipeline{
		{{Key: "$geoNear", Value: bson.D{
			{Key: "near", Value: bson.D{
				{Key: "type", Value: "Point"},
				{Key: "coordinates", Value: bson.A{lng, lat}},
			}},
			{Key: "distanceField", Value: "distance_meters"},
			{Key: "spherical", Value: true},
		}}},
		{{Key: "$limit", Value: 1}},
	}

	cursor, err := s.coll.Aggregate(ctx, pipeline)
	if err == nil {
		defer cursor.Close(ctx)
		var places []domain.Place
		if err := cursor.All(ctx, &places); err == nil && len(places) > 0 {
			return &places[0], nil
		}
	}

	// Fallback to FindOne with $nearSphere
	filter := bson.M{
		"location": bson.M{
			"$nearSphere": bson.M{
				"$geometry": bson.M{
					"type":        "Point",
					"coordinates": bson.A{lng, lat},
				},
			},
		},
	}

	var place domain.Place
	if err := s.coll.FindOne(ctx, filter).Decode(&place); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, domain.ErrPlaceNotFound
		}
		return nil, err
	}

	place.DistanceMeters = math.Round(utils.HaversineDistance(lat, lng, place.Location.Latitude, place.Location.Longitude)*10) / 10
	return &place, nil
}

func (s *placesService) CreatePlace(ctx context.Context, place *domain.Place) error {
	if s.coll == nil {
		return errors.New("database not connected")
	}

	if place.Location.Latitude == 0 && place.Location.Longitude == 0 {
		return domain.ErrInvalidLocationPoint
	}

	if place.ID == uuid.Nil {
		place.ID = uuid.New()
	}
	now := time.Now()
	if place.CreatedAt.IsZero() {
		place.CreatedAt = now
	}
	place.UpdatedAt = now

	if place.Location.Type == "" {
		place.Location.Type = "Point"
	}
	if len(place.Location.Coordinates) < 2 {
		place.Location.Coordinates = []float64{place.Location.Longitude, place.Location.Latitude}
	}

	_, err := s.coll.InsertOne(ctx, place)
	if err == nil && s.l1Cache != nil {
		s.l1Cache.Clear()
	}
	return err
}

// Ensure database GeoPoint compatibility
var _ database.GeoPoint
