package spatial

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	DriversGeoKey = "fleet:drivers:geo"
	DriverInfoKey = "fleet:driver:info:"
)

type NearbyDriver struct {
	DriverID  string  `json:"driver_id"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	DistanceM float64 `json:"distance_meters"`
	Heading   float64 `json:"heading"`
}

type SpatialIndexer interface {
	UpdateDriverPosition(ctx context.Context, driverID string, lat, lng, heading, speed float64) error
	FindNearbyDrivers(ctx context.Context, lat, lng, radiusMeters float64, limit int) ([]NearbyDriver, error)
	RemoveDriver(ctx context.Context, driverID string) error
}

type redisSpatialIndexer struct {
	rdb *redis.Client
}

func NewSpatialIndexer(rdb *redis.Client) SpatialIndexer {
	return &redisSpatialIndexer{rdb: rdb}
}

// UpdateDriverPosition adds/updates driver coordinates in the Redis GEO set and caches telemetry details.
func (s *redisSpatialIndexer) UpdateDriverPosition(ctx context.Context, driverID string, lat, lng, heading, speed float64) error {
	pipe := s.rdb.Pipeline()

	// 1. Update Geospatial Index
	pipe.GeoAdd(ctx, DriversGeoKey, &redis.GeoLocation{
		Name:      driverID,
		Longitude: lng,
		Latitude:  lat,
	})

	// 2. Cache driver telemetry info (Heading, Speed, Timestamp) with 10-minute TTL
	infoKey := DriverInfoKey + driverID
	pipe.HSet(ctx, infoKey, map[string]interface{}{
		"lat":       lat,
		"lng":       lng,
		"heading":   heading,
		"speed":     speed,
		"updatedAt": time.Now().Unix(),
	})
	pipe.Expire(ctx, infoKey, 10*time.Minute)

	_, err := pipe.Exec(ctx)
	return err
}

// FindNearbyDrivers searches Redis GEO for active drivers within a radius in meters, sorted by proximity.
func (s *redisSpatialIndexer) FindNearbyDrivers(ctx context.Context, lat, lng, radiusMeters float64, limit int) ([]NearbyDriver, error) {
	if limit <= 0 {
		limit = 10
	}

	locations, err := s.rdb.GeoSearchLocation(ctx, DriversGeoKey, &redis.GeoSearchLocationQuery{
		GeoSearchQuery: redis.GeoSearchQuery{
			Longitude:  lng,
			Latitude:   lat,
			Radius:     radiusMeters,
			RadiusUnit: "m",
			Sort:       "ASC",
			Count:      limit,
		},
		WithCoord: true,
		WithDist:  true,
	}).Result()

	if err != nil {
		return nil, fmt.Errorf("failed to execute GeoSearch on Redis: %w", err)
	}

	drivers := make([]NearbyDriver, 0, len(locations))
	for _, loc := range locations {
		var heading float64
		// Retrieve cached heading if available
		if hVal, err := s.rdb.HGet(ctx, DriverInfoKey+loc.Name, "heading").Result(); err == nil {
			heading, _ = strconv.ParseFloat(hVal, 64)
		}

		drivers = append(drivers, NearbyDriver{
			DriverID:  loc.Name,
			Latitude:  loc.Latitude,
			Longitude: loc.Longitude,
			DistanceM: loc.Dist,
			Heading:   heading,
		})
	}

	return drivers, nil
}

// RemoveDriver removes an offline driver from the spatial index.
func (s *redisSpatialIndexer) RemoveDriver(ctx context.Context, driverID string) error {
	pipe := s.rdb.Pipeline()
	pipe.ZRem(ctx, DriversGeoKey, driverID)
	pipe.Del(ctx, DriverInfoKey+driverID)
	_, err := pipe.Exec(ctx)
	return err
}
