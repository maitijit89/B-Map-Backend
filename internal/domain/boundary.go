package domain

import (
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/pkg/database"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type BorderType string

const (
	BorderTypeOfficialInternational BorderType = "official_international" // Red solid border
	BorderTypeDisputed              BorderType = "disputed"               // Red dashed border
	BorderTypeStateProvincial       BorderType = "state_provincial"       // Gray/Blue dashed
	BorderTypeMaritime              BorderType = "maritime"               // Dotted maritime zone
)

// Boundary represents a geopolitical administrative border or territory stored in MongoDB.
type Boundary struct {
	ID          uuid.UUID         `json:"id" bson:"_id,omitempty"`
	Name        string            `json:"name" bson:"name"`
	AdminLevel  int               `json:"admin_level" bson:"admin_level"` // 0: Country, 1: State/Province, 2: City/District
	CountryCode string            `json:"country_code" bson:"country_code"`
	BorderType  BorderType        `json:"border_type" bson:"border_type"`
	CenterPoint database.GeoPoint `json:"center_point" bson:"center_point"`
	CreatedAt   time.Time         `json:"created_at" bson:"created_at"`
}

// RegionHighlight represents a search result boundary polygon for map visual highlighting.
type RegionHighlight struct {
	ID               string                 `json:"id"`
	Name             string                 `json:"name"`
	AdminLevel       int                    `json:"admin_level"`
	CountryCode      string                 `json:"country_code"`
	BoundingBox      [4]float64             `json:"bounding_box"` // [minLng, minLat, maxLng, maxLat]
	Center           utils.Coordinate       `json:"center"`
	AreaSqKm         float64                `json:"area_sq_km"`
	BoundaryGeoJSON  map[string]interface{} `json:"boundary_geojson"`
	MaskPolygonJSON  map[string]interface{} `json:"mask_polygon_geojson"` // Inverted world polygon for dimming outside area
	StrokeColor      string                 `json:"stroke_color"`          // Red official line "#d93025" or Highlight Blue "#1a73e8"
	StrokeWidth      float64                `json:"stroke_width"`
	FillColor        string                 `json:"fill_color"`
	FillOpacity      float64                `json:"fill_opacity"`
	IsDisputedBorder bool                   `json:"is_disputed_border"`
}
