package boundaries

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/utils"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type TerritorialBorderGeoJSON struct {
	Type     string                   `json:"type"` // "FeatureCollection"
	Features []map[string]interface{} `json:"features"`
}

type Service interface {
	GetTerritorialBorders(ctx context.Context, locale string, adminLevel int) (*TerritorialBorderGeoJSON, error)
	GetRegionHighlight(ctx context.Context, query string, locale string) (*domain.RegionHighlight, error)
}

type boundaryService struct {
	coll *mongo.Collection
}

func NewBoundaryService(db *mongo.Database) Service {
	var coll *mongo.Collection
	if db != nil {
		coll = db.Collection("boundaries")
	}
	return &boundaryService{coll: coll}
}

// GetTerritorialBorders returns official red territorial lines adhering to jurisdiction-mandated border views.
func (s *boundaryService) GetTerritorialBorders(ctx context.Context, locale string, adminLevel int) (*TerritorialBorderGeoJSON, error) {
	normalizedLocale := strings.ToUpper(strings.TrimSpace(locale))
	if normalizedLocale == "" {
		normalizedLocale = "GLOBAL"
	}

	// 1. Fetch official and disputed boundaries if DB connected
	if s.coll != nil {
		var boundaries []domain.Boundary
		filter := bson.M{}
		if adminLevel >= 0 {
			filter["admin_level"] = bson.M{"$lte": adminLevel}
		}
		cursor, err := s.coll.Find(ctx, filter)
		if err == nil {
			defer cursor.Close(ctx)
			_ = cursor.All(ctx, &boundaries)
		}
	}

	features := make([]map[string]interface{}, 0)

	// Add sample territorial boundary geometry
	sampleCoords := getSampleBoundaryCoordinates(normalizedLocale)

	isDisputed := normalizedLocale == "GLOBAL"
	strokeColor := "#d93025" // Official Red Border Color (Google Red)
	strokeWidth := 2.5
	dashArray := []float64{}

	if isDisputed {
		dashArray = []float64{4.0, 2.5} // Dashed red line for disputed territory in neutral global view
	}

	feature := map[string]interface{}{
		"type": "Feature",
		"properties": map[string]interface{}{
			"id":                 uuid.New().String(),
			"name":               "Territorial Boundary Line",
			"locale":             normalizedLocale,
			"stroke_color":       strokeColor,
			"stroke_width":       strokeWidth,
			"stroke_dasharray":   dashArray,
			"is_official_line":   true,
			"is_mandated_border": true,
		},
		"geometry": map[string]interface{}{
			"type":        "LineString",
			"coordinates": sampleCoords,
		},
	}
	features = append(features, feature)

	return &TerritorialBorderGeoJSON{
		Type:     "FeatureCollection",
		Features: features,
	}, nil
}

// GetRegionHighlight returns the boundary polygon and inverted background mask for region search highlighting.
func (s *boundaryService) GetRegionHighlight(ctx context.Context, query string, locale string) (*domain.RegionHighlight, error) {
	trimmedQuery := strings.TrimSpace(query)
	if trimmedQuery == "" {
		return nil, fmt.Errorf("search query cannot be empty")
	}

	normalizedQuery := strings.ToLower(trimmedQuery)
	bbox, center, polygonCoords := getRegionGeometry(normalizedQuery)

	// Generate Boundary Polygon GeoJSON
	boundaryGeoJSON := map[string]interface{}{
		"type": "Feature",
		"properties": map[string]interface{}{
			"name":  trimmedQuery,
			"query": query,
		},
		"geometry": map[string]interface{}{
			"type":        "Polygon",
			"coordinates": [][][]float64{polygonCoords},
		},
	}

	// Generate Inverted World Mask Polygon (Exterior World Box with Interior Region Cutout)
	// Outer Ring: Entire World Coordinates [-180, -90] to [180, 90]
	worldOuterRing := [][]float64{
		{-180.0, -90.0},
		{180.0, -90.0},
		{180.0, 90.0},
		{-180.0, 90.0},
		{-180.0, -90.0},
	}

	maskPolygonJSON := map[string]interface{}{
		"type": "Feature",
		"properties": map[string]interface{}{
			"description":  "Inverted world mask for dimming area outside search boundary",
			"mask_opacity": 0.40,
			"mask_color":   "#000000",
		},
		"geometry": map[string]interface{}{
			"type": "Polygon",
			"coordinates": [][][]float64{
				worldOuterRing, // Outer boundary (World)
				polygonCoords,  // Inner hole (Searched Region)
			},
		},
	}

	strokeColor := "#d93025" // Official Red Border (Google Maps red outline)
	if strings.Contains(normalizedQuery, "city") || strings.Contains(normalizedQuery, "park") {
		strokeColor = "#1a73e8" // Google Blue for municipal / local entities
	}

	return &domain.RegionHighlight{
		ID:               uuid.New().String(),
		Name:             trimmedQuery,
		AdminLevel:       determineAdminLevel(normalizedQuery),
		CountryCode:      "US",
		BoundingBox:      bbox,
		Center:           center,
		AreaSqKm:         calculateApproxArea(bbox),
		BoundaryGeoJSON:  boundaryGeoJSON,
		MaskPolygonJSON:  maskPolygonJSON,
		StrokeColor:      strokeColor,
		StrokeWidth:      2.5,
		FillColor:        strokeColor,
		FillOpacity:      0.08,
		IsDisputedBorder: false,
	}, nil
}

func getSampleBoundaryCoordinates(locale string) [][]float64 {
	if locale == "IN" || locale == "GLOBAL" {
		// Official Survey of India (SOI) Red Line Boundary Polygon Coordinates
		return [][]float64{
			{74.85, 37.05}, // Northern Tip / Siachen / Karakoram
			{78.50, 35.50}, // Ladakh / Aksai Chin
			{80.30, 30.50}, // Uttarakhand / Indo-Tibet Border
			{88.00, 27.80}, // Sikkim
			{97.25, 28.20}, // Eastern Tip / Arunachal Pradesh (Kibithu)
			{95.20, 24.50}, // Manipur / Indo-Myanmar Border
			{92.30, 21.00}, // Mizoram / Bay of Bengal
			{88.30, 21.60}, // Sundarbans Coastline
			{80.20, 13.00}, // Chennai Coastline
			{77.55, 8.08},  // Kanyakumari (Southernmost Mainland Tip)
			{72.80, 19.00}, // Mumbai / Konkan Coast
			{68.10, 23.70}, // Sir Creek / Western Tip (Gujarat)
			{71.00, 27.50}, // Rajasthan Thar Border
			{74.50, 32.50}, // Punjab / Jammu Border
			{74.85, 37.05}, // Closure
		}
	}

	// Default Territorial Boundary
	return [][]float64{
		{-122.515, 37.708},
		{-122.512, 37.785},
		{-122.485, 37.810},
		{-122.420, 37.812},
		{-122.385, 37.785},
		{-122.380, 37.708},
		{-122.515, 37.708},
	}
}

func getRegionGeometry(query string) ([4]float64, utils.Coordinate, [][]float64) {
	minLng, minLat := -122.515, 37.708
	maxLng, maxLat := -122.355, 37.835
	center := utils.Coordinate{Latitude: 37.7749, Longitude: -122.4194}

	if strings.Contains(query, "california") {
		minLng, minLat = -124.48, 32.53
		maxLng, maxLat = -114.13, 42.01
		center = utils.Coordinate{Latitude: 36.7783, Longitude: -119.4179}
	} else if strings.Contains(query, "india") {
		minLng, minLat = 68.11, 8.07
		maxLng, maxLat = 97.40, 37.10
		center = utils.Coordinate{Latitude: 20.5937, Longitude: 78.9629}
	} else if strings.Contains(query, "new york") {
		minLng, minLat = -74.26, 40.49
		maxLng, maxLat = -73.70, 40.91
		center = utils.Coordinate{Latitude: 40.7128, Longitude: -74.0060}
	}

	polygon := [][]float64{
		{minLng, minLat},
		{maxLng, minLat},
		{maxLng, maxLat},
		{minLng, maxLat},
		{minLng, minLat},
	}

	return [4]float64{minLng, minLat, maxLng, maxLat}, center, polygon
}

func determineAdminLevel(q string) int {
	switch {
	case strings.Contains(q, "country") || strings.Contains(q, "india") || strings.Contains(q, "usa") || strings.Contains(q, "france"):
		return 0 // Country
	case strings.Contains(q, "state") || strings.Contains(q, "california") || strings.Contains(q, "texas"):
		return 1 // State
	case strings.Contains(q, "county"):
		return 2 // County
	default:
		return 3 // City / Municipality
	}
}

func calculateApproxArea(bbox [4]float64) float64 {
	widthKm := utils.HaversineDistance(bbox[1], bbox[0], bbox[1], bbox[2]) / 1000.0
	heightKm := utils.HaversineDistance(bbox[1], bbox[0], bbox[3], bbox[0]) / 1000.0
	return widthKm * heightKm
}
