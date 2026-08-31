package tiles

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/cache"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var tileBufferPool = sync.Pool{
	New: func() interface{} {
		return new(bytes.Buffer)
	},
}

type TileService interface {
	GetVectorTile(ctx context.Context, z, x, y int) ([]byte, error)
}

type tileService struct {
	coll    *mongo.Collection
	rdb     *redis.Client
	l1Cache *cache.LRUCache
}

func NewTileService(db *mongo.Database, rdb *redis.Client) TileService {
	return &tileService{
		coll:    db.Collection("places"),
		rdb:     rdb,
		l1Cache: cache.NewLRUCache(4000, 30*time.Minute),
	}
}

// GetVectorTile generates or fetches from Multi-tier Cache (L1 in-memory + L2 Redis) a Vector Tile for (z, x, y).
func (s *tileService) GetVectorTile(ctx context.Context, z, x, y int) ([]byte, error) {
	cacheKey := fmt.Sprintf("tile:mvt:%d:%d:%d", z, x, y)

	// 1. Check L1 In-Memory Fast Cache (<100 microseconds)
	if s.l1Cache != nil {
		if val, found := s.l1Cache.Get(cacheKey); found {
			if tileBytes, ok := val.([]byte); ok && len(tileBytes) > 0 {
				return tileBytes, nil
			}
		}
	}

	// 2. Check L2 Redis Cache (<2 milliseconds)
	if s.rdb != nil {
		if cachedData, err := s.rdb.Get(ctx, cacheKey).Bytes(); err == nil && len(cachedData) > 0 {
			if s.l1Cache != nil {
				s.l1Cache.Set(cacheKey, cachedData)
			}
			return cachedData, nil
		}
	}

	// 3. Compute tile bounding box in WGS84
	minLng, minLat, maxLng, maxLat := tileBounds(z, x, y)

	// 4. Query MongoDB for places inside tile envelope using 2dsphere $geoWithin Polygon with projection
	polygon := [][][]float64{{
		{minLng, minLat},
		{maxLng, minLat},
		{maxLng, maxLat},
		{minLng, maxLat},
		{minLng, minLat},
	}}

	filter := bson.M{
		"location": bson.M{
			"$geoWithin": bson.M{
				"$geometry": bson.M{
					"type":        "Polygon",
					"coordinates": polygon,
				},
			},
		},
	}

	findOpts := options.Find().SetProjection(bson.M{
		"_id":         1,
		"name":        1,
		"category":    1,
		"address":     1,
		"description": 1,
		"location":    1,
	})

	cursor, err := s.coll.Find(ctx, filter, findOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to query places for tile (%d, %d, %d): %w", z, x, y, err)
	}
	defer cursor.Close(ctx)

	var places []domain.Place
	if err := cursor.All(ctx, &places); err != nil {
		return nil, err
	}

	// 5. Encode tile FeatureCollection and compress with gzip
	featureCollection := map[string]interface{}{
		"type": "FeatureCollection",
		"name": "places",
		"crs": map[string]interface{}{
			"type": "name",
			"properties": map[string]interface{}{
				"name": "urn:ogc:def:crs:OGC:1.3:CRS84",
			},
		},
		"tile": map[string]int{
			"z": z,
			"x": x,
			"y": y,
		},
		"features": make([]map[string]interface{}, 0, len(places)),
	}

	features := make([]map[string]interface{}, 0, len(places))
	for _, p := range places {
		features = append(features, map[string]interface{}{
			"type": "Feature",
			"geometry": map[string]interface{}{
				"type":        "Point",
				"coordinates": []float64{p.Location.Longitude, p.Location.Latitude},
			},
			"properties": map[string]interface{}{
				"id":          p.ID.String(),
				"name":        p.Name,
				"category":    p.Category,
				"address":     p.Address,
				"description": p.Description,
			},
		})
	}
	featureCollection["features"] = features

	tileJSON, err := json.Marshal(featureCollection)
	if err != nil {
		return nil, fmt.Errorf("failed to encode vector tile json: %w", err)
	}

	buf := tileBufferPool.Get().(*bytes.Buffer)
	buf.Reset()
	defer tileBufferPool.Put(buf)

	gzWriter := gzip.NewWriter(buf)
	if _, err := gzWriter.Write(tileJSON); err != nil {
		return nil, err
	}
	_ = gzWriter.Close()
	tileData := make([]byte, buf.Len())
	copy(tileData, buf.Bytes())

	// 6. Cache rendered binary tile in L1 Memory and L2 Redis
	if len(tileData) > 0 {
		ttl := calculateTileTTL(z)
		if s.l1Cache != nil {
			s.l1Cache.SetWithTTL(cacheKey, tileData, ttl)
		}
		if s.rdb != nil {
			_ = s.rdb.Set(ctx, cacheKey, tileData, ttl).Err()
		}
	}

	return tileData, nil
}

func tileBounds(z, x, y int) (minLng, minLat, maxLng, maxLat float64) {
	minLng = tile2lon(x, z)
	maxLat = tile2lat(y, z)
	maxLng = tile2lon(x+1, z)
	minLat = tile2lat(y+1, z)
	return
}

func tile2lon(x int, z int) float64 {
	return float64(x)/float64(int(1)<<z)*360.0 - 180.0
}

func tile2lat(y int, z int) float64 {
	n := math.Pi - 2.0*math.Pi*float64(y)/float64(int(1)<<z)
	return 180.0 / math.Pi * math.Atan(0.5*(math.Exp(n)-math.Exp(-n)))
}

func calculateTileTTL(zoom int) time.Duration {
	switch {
	case zoom <= 8:
		return 24 * time.Hour // Regional/Continental views change rarely
	case zoom <= 13:
		return 6 * time.Hour
	default:
		return 1 * time.Hour // Local street views updated frequently
	}
}
