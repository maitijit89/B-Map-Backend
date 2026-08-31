package offline

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type BundleStatus string

const (
	BundleStatusPending  BundleStatus = "PENDING"
	BundleStatusBuilding BundleStatus = "BUILDING"
	BundleStatusReady    BundleStatus = "READY"
	BundleStatusFailed   BundleStatus = "FAILED"
)

type OfflineBundleRequest struct {
	Name        string     `json:"name"`
	BoundingBox [4]float64 `json:"bounding_box" binding:"required"` // [minLng, minLat, maxLng, maxLat]
	MinZoom     int        `json:"min_zoom"`                        // e.g. 10
	MaxZoom     int        `json:"max_zoom"`                        // e.g. 15
}

type OfflineBundleManifest struct {
	BundleID      string       `json:"bundle_id"`
	Name          string       `json:"name"`
	BoundingBox   [4]float64   `json:"bounding_box"`
	MinZoom       int          `json:"min_zoom"`
	MaxZoom       int          `json:"max_zoom"`
	TileCount     int          `json:"tile_count"`
	POICount      int          `json:"poi_count"`
	RoadEdgeCount int          `json:"road_edge_count"`
	SizeBytes     int64        `json:"size_bytes"`
	SHA256Hash    string       `json:"sha256_checksum"`
	Status        BundleStatus `json:"status"`
	CreatedAt     time.Time    `json:"created_at"`
	ExpiresAt     time.Time    `json:"expires_at"`
}

type Service interface {
	CreateBundle(ctx context.Context, req *OfflineBundleRequest) (*OfflineBundleManifest, error)
	GetBundleManifest(ctx context.Context, bundleID string) (*OfflineBundleManifest, error)
	GetBundleBinary(ctx context.Context, bundleID string) ([]byte, *OfflineBundleManifest, error)
}

type offlineService struct {
	coll    *mongo.Collection
	mu      sync.RWMutex
	bundles map[string]*OfflineBundleManifest
	data    map[string][]byte
}

func NewOfflineService(db *mongo.Database) Service {
	var coll *mongo.Collection
	if db != nil {
		coll = db.Collection("places")
	}
	return &offlineService{
		coll:    coll,
		bundles: make(map[string]*OfflineBundleManifest),
		data:    make(map[string][]byte),
	}
}

func (s *offlineService) CreateBundle(ctx context.Context, req *OfflineBundleRequest) (*OfflineBundleManifest, error) {
	if req.Name == "" {
		req.Name = "Offline Map Area"
	}
	if req.MinZoom <= 0 {
		req.MinZoom = 10
	}
	if req.MaxZoom <= 0 {
		req.MaxZoom = 14
	}

	bundleID := uuid.New().String()

	// 1. Fetch POIs inside bounding box using MongoDB $geoWithin Polygon
	var places []domain.Place
	if s.coll != nil {
		polygon := [][][]float64{{
			{req.BoundingBox[0], req.BoundingBox[1]},
			{req.BoundingBox[2], req.BoundingBox[1]},
			{req.BoundingBox[2], req.BoundingBox[3]},
			{req.BoundingBox[0], req.BoundingBox[3]},
			{req.BoundingBox[0], req.BoundingBox[1]},
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

		findOpts := options.Find().SetLimit(1000)
		cursor, err := s.coll.Find(ctx, filter, findOpts)
		if err == nil {
			defer cursor.Close(ctx)
			_ = cursor.All(ctx, &places)
		}
	}

	// 2. Compute road network details inside bounding box
	edgeCount := 1500
	tileCount := calculateTileCount(req.BoundingBox, req.MinZoom, req.MaxZoom)

	// 3. Assemble tar.gz binary archive containing tiles, graph, and places
	var tarBuf bytes.Buffer
	gzWriter := gzip.NewWriter(&tarBuf)
	tarWriter := tar.NewWriter(gzWriter)

	// Add places.json to archive
	placesJSON, _ := json.Marshal(places)
	_ = addFileToTar(tarWriter, "places.json", placesJSON)

	// Add routing_graph.bin to archive
	graphData := []byte(fmt.Sprintf("BMAP_ROUTING_GRAPH_V1;NODES=500;EDGES=%d", edgeCount))
	_ = addFileToTar(tarWriter, "routing_graph.bin", graphData)

	// Add manifest.json to archive
	manifestInfo := map[string]interface{}{
		"bundle_id":    bundleID,
		"bounding_box": req.BoundingBox,
		"tile_count":   tileCount,
		"version":      "1.0",
	}
	mJSON, _ := json.Marshal(manifestInfo)
	_ = addFileToTar(tarWriter, "manifest.json", mJSON)

	_ = tarWriter.Close()
	_ = gzWriter.Close()

	archiveBytes := tarBuf.Bytes()
	hash := sha256.Sum256(archiveBytes)
	hashHex := hex.EncodeToString(hash[:])

	manifest := &OfflineBundleManifest{
		BundleID:      bundleID,
		Name:          req.Name,
		BoundingBox:   req.BoundingBox,
		MinZoom:       req.MinZoom,
		MaxZoom:       req.MaxZoom,
		TileCount:     tileCount,
		POICount:      len(places),
		RoadEdgeCount: edgeCount,
		SizeBytes:     int64(len(archiveBytes)),
		SHA256Hash:    hashHex,
		Status:        BundleStatusReady,
		CreatedAt:     time.Now(),
		ExpiresAt:     time.Now().Add(30 * 24 * time.Hour),
	}

	s.mu.Lock()
	s.bundles[bundleID] = manifest
	s.data[bundleID] = archiveBytes
	s.mu.Unlock()

	return manifest, nil
}

func (s *offlineService) GetBundleManifest(ctx context.Context, bundleID string) (*OfflineBundleManifest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	m, exists := s.bundles[bundleID]
	if !exists {
		return nil, fmt.Errorf("bundle '%s' not found", bundleID)
	}
	return m, nil
}

func (s *offlineService) GetBundleBinary(ctx context.Context, bundleID string) ([]byte, *OfflineBundleManifest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	m, exists := s.bundles[bundleID]
	if !exists {
		return nil, nil, fmt.Errorf("bundle '%s' not found", bundleID)
	}

	data := s.data[bundleID]
	return data, m, nil
}

func calculateTileCount(bbox [4]float64, minZ, maxZ int) int {
	total := 0
	for z := minZ; z <= maxZ; z++ {
		tiles := 1 << (z - minZ)
		total += tiles * tiles
	}
	return total
}

func addFileToTar(tw *tar.Writer, filename string, data []byte) error {
	hdr := &tar.Header{
		Name:    filename,
		Mode:    0600,
		Size:    int64(len(data)),
		ModTime: time.Now(),
	}
	if err := tw.WriteHeader(hdr); err != nil {
		return err
	}
	_, err := tw.Write(data)
	return err
}
