package mongodb

import (
	"context"
	"errors"
	"math"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/utils"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type placeRepository struct {
	coll *mongo.Collection
}

// NewPlaceRepository initializes a new MongoDB 2dsphere-enabled Place repository.
func NewPlaceRepository(db *mongo.Database) domain.PlaceRepository {
	return &placeRepository{
		coll: db.Collection("places"),
	}
}

func (r *placeRepository) Create(ctx context.Context, place *domain.Place) error {
	if place.ID == uuid.Nil {
		place.ID = uuid.New()
	}
	now := time.Now()
	if place.CreatedAt.IsZero() {
		place.CreatedAt = now
	}
	place.UpdatedAt = now

	// Ensure GeoJSON consistency
	if place.Location.Type == "" {
		place.Location.Type = "Point"
	}
	if len(place.Location.Coordinates) < 2 {
		place.Location.Coordinates = []float64{place.Location.Longitude, place.Location.Latitude}
	}

	_, err := r.coll.InsertOne(ctx, place)
	return err
}

func (r *placeRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Place, error) {
	var place domain.Place
	err := r.coll.FindOne(ctx, bson.M{"_id": id}).Decode(&place)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, domain.ErrPlaceNotFound
		}
		return nil, err
	}
	return &place, nil
}

// FindWithinRadius retrieves places within radius (in meters) using MongoDB $geoNear aggregation.
func (r *placeRepository) FindWithinRadius(ctx context.Context, lat, lng, radiusMeters float64, category string, limit, offset int) ([]domain.Place, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	matchQuery := bson.M{}
	if category != "" {
		matchQuery["category"] = bson.M{
			"$regex":   "^" + regexp.QuoteMeta(strings.TrimSpace(category)) + "$",
			"$options": "i",
		}
	}

	geoNearStage := bson.D{{Key: "$geoNear", Value: bson.D{
		{Key: "near", Value: bson.D{
			{Key: "type", Value: "Point"},
			{Key: "coordinates", Value: bson.A{lng, lat}},
		}},
		{Key: "distanceField", Value: "distance_meters"},
		{Key: "maxDistance", Value: radiusMeters},
		{Key: "spherical", Value: true},
		{Key: "query", Value: matchQuery},
	}}}

	// Pipeline to fetch paginated results and total count
	pipeline := mongo.Pipeline{
		geoNearStage,
		{{Key: "$facet", Value: bson.M{
			"metadata": []bson.M{{"$count": "total"}},
			"data":     []bson.M{{"$skip": offset}, {"$limit": limit}},
		}}},
	}

	cursor, err := r.coll.Aggregate(ctx, pipeline)
	if err != nil {
		// Fallback to standard $geoWithin if $geoNear aggregation encounters an issue
		return r.findWithinRadiusFallback(ctx, lat, lng, radiusMeters, category, limit, offset)
	}
	defer cursor.Close(ctx)

	type FacetResult struct {
		Metadata []struct {
			Total int64 `bson:"total"`
		} `bson:"metadata"`
		Data []domain.Place `bson:"data"`
	}

	var results []FacetResult
	if err := cursor.All(ctx, &results); err != nil || len(results) == 0 {
		return []domain.Place{}, 0, err
	}

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

// Fallback search using $geoWithin and $centerSphere
func (r *placeRepository) findWithinRadiusFallback(ctx context.Context, lat, lng, radiusMeters float64, category string, limit, offset int) ([]domain.Place, int64, error) {
	// Earth radius in meters ~ 6,378,137m
	radiusRadians := radiusMeters / 6378137.0

	filter := bson.M{
		"location": bson.M{
			"$geoWithin": bson.M{
				"$centerSphere": bson.A{bson.A{lng, lat}, radiusRadians},
			},
		},
	}

	if category != "" {
		filter["category"] = bson.M{
			"$regex":   "^" + regexp.QuoteMeta(strings.TrimSpace(category)) + "$",
			"$options": "i",
		}
	}

	total, err := r.coll.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	findOpts := options.Find().
		SetLimit(int64(limit)).
		SetSkip(int64(offset))

	cursor, err := r.coll.Find(ctx, filter, findOpts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var places []domain.Place
	if err := cursor.All(ctx, &places); err != nil {
		return nil, 0, err
	}

	for i := range places {
		places[i].DistanceMeters = math.Round(utils.HaversineDistance(lat, lng, places[i].Location.Latitude, places[i].Location.Longitude)*10) / 10
	}

	return places, total, nil
}

// FindNearest finds the N nearest places to a coordinate.
func (r *placeRepository) FindNearest(ctx context.Context, lat, lng float64, limit int) ([]domain.Place, error) {
	if limit <= 0 {
		limit = 10
	}

	pipeline := mongo.Pipeline{
		{{Key: "$geoNear", Value: bson.D{
			{Key: "near", Value: bson.D{
				{Key: "type", Value: "Point"},
				{Key: "coordinates", Value: bson.A{lng, lat}},
			}},
			{Key: "distanceField", Value: "distance_meters"},
			{Key: "spherical", Value: true},
		}}},
		{{Key: "$limit", Value: limit}},
	}

	cursor, err := r.coll.Aggregate(ctx, pipeline)
	if err != nil {
		// Fallback to find with $nearSphere
		findOpts := options.Find().SetLimit(int64(limit))
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
		fallbackCursor, fallbackErr := r.coll.Find(ctx, filter, findOpts)
		if fallbackErr != nil {
			return nil, fallbackErr
		}
		defer fallbackCursor.Close(ctx)

		var places []domain.Place
		if err := fallbackCursor.All(ctx, &places); err != nil {
			return nil, err
		}
		for i := range places {
			places[i].DistanceMeters = math.Round(utils.HaversineDistance(lat, lng, places[i].Location.Latitude, places[i].Location.Longitude)*10) / 10
		}
		return places, nil
	}
	defer cursor.Close(ctx)

	var places []domain.Place
	if err := cursor.All(ctx, &places); err != nil {
		return nil, err
	}

	return places, nil
}

func (r *placeRepository) Update(ctx context.Context, place *domain.Place) error {
	place.UpdatedAt = time.Now()
	res, err := r.coll.ReplaceOne(ctx, bson.M{"_id": place.ID}, place)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return domain.ErrPlaceNotFound
	}
	return nil
}

func (r *placeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.coll.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return domain.ErrPlaceNotFound
	}
	return nil
}
