package tiles

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type TileService interface {
	GetVectorTile(ctx context.Context, z, x, y int) ([]byte, error)
}

type tileService struct {
	db  *gorm.DB
	rdb *redis.Client
}

func NewTileService(db *gorm.DB, rdb *redis.Client) TileService {
	return &tileService{
		db:  db,
		rdb: rdb,
	}
}

// GetVectorTile generates or fetches from Redis a Mapbox Vector Tile (MVT) for tile coordinate (z, x, y).
func (s *tileService) GetVectorTile(ctx context.Context, z, x, y int) ([]byte, error) {
	cacheKey := fmt.Sprintf("tile:mvt:%d:%d:%d", z, x, y)

	// 1. Check Redis L1 Cache
	if cachedData, err := s.rdb.Get(ctx, cacheKey).Bytes(); err == nil && len(cachedData) > 0 {
		return cachedData, nil
	}

	// 2. Query PostGIS ST_AsMVT to build vector tile dynamically
	// Uses ST_TileEnvelope(z, x, y) to construct tile bounding box in EPSG:3857 (Web Mercator)
	query := `
		WITH bounds AS (
			SELECT ST_TileEnvelope(?, ?, ?) AS envelope
		),
		mvt_places AS (
			SELECT 
				p.id,
				p.name,
				p.category,
				p.address,
				ST_AsMVTGeom(
					ST_Transform(p.location, 3857),
					bounds.envelope,
					4096,
					256,
					true
				) AS geom
			FROM places p, bounds
			WHERE ST_Intersects(ST_Transform(p.location, 3857), bounds.envelope)
		)
		SELECT ST_AsMVT(mvt_places.*, 'places', 4096, 'geom') AS mvt FROM mvt_places;
	`

	var tileData []byte
	row := s.db.WithContext(ctx).Raw(query, z, x, y).Row()
	if err := row.Scan(&tileData); err != nil {
		return nil, fmt.Errorf("failed to generate MVT from PostGIS: %w", err)
	}

	// 3. Cache rendered binary tile in Redis
	ttl := calculateTileTTL(z)
	if len(tileData) > 0 {
		_ = s.rdb.Set(ctx, cacheKey, tileData, ttl).Err()
	}

	return tileData, nil
}

func calculateTileTTL(zoom int) time.Duration {
	switch {
	case zoom <= 8:
		return 24 * time.Hour // Regional/Continental views change rarely
	case zoom <= 13:
		return 6 * time.Hour
	default:
		return 1 * time.Hour  // Local street views updated frequently
	}
}
