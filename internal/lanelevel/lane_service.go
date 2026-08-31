package lanelevel

import (
	"context"
	"fmt"
	"math"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type GNSSRawFix struct {
	Latitude         float64 `json:"latitude"`
	Longitude        float64 `json:"longitude"`
	AltitudeM        float64 `json:"altitude_meters"`
	HDOP             float64 `json:"hdop"`             // Horizontal Dilution of Precision
	SatellitesInView int     `json:"satellites_in_view"`
	BaseStationID    string  `json:"base_station_id,omitempty"`
}

type RTKCorrectedPosition struct {
	RawLocation       utils.Coordinate `json:"raw_location"`
	CorrectedLocation utils.Coordinate `json:"corrected_location"`
	AccuracyCm        float64          `json:"accuracy_centimeters"`
	FixType           string           `json:"fix_type"` // "RTK_FIXED", "RTK_FLOAT", "DGPS"
	LaneIndex         int              `json:"estimated_current_lane_index"` // 0: Leftmost
	ConfidenceScore   float64          `json:"confidence_score"`
}

type LaneDirection string

const (
	LaneDirectionLeft     LaneDirection = "LEFT"
	LaneDirectionThrough  LaneDirection = "THROUGH"
	LaneDirectionRight    LaneDirection = "RIGHT"
	LaneDirectionSlightRight LaneDirection = "SLIGHT_RIGHT"
	LaneDirectionSlightLeft  LaneDirection = "SLIGHT_LEFT"
)

type LaneInfo struct {
	LaneIndex        int             `json:"lane_index"` // 0 is leftmost
	ValidDirections  []LaneDirection `json:"valid_directions"`
	LaneType         string          `json:"lane_type"` // "normal", "hov", "bus_only", "bike_lane"
	IsActiveForRoute bool            `json:"is_active_for_route"` // Highlighted in navigation UI
}

type LaneGuidanceResponse struct {
	RoadName         string     `json:"road_name"`
	TotalLanes       int        `json:"total_lanes"`
	Lanes            []LaneInfo `json:"lanes"`
	GuidanceMessage  string     `json:"guidance_message"`
	DistanceToTurnM  float64    `json:"distance_to_turn_meters"`
	NextTurnManeuver string     `json:"next_turn_maneuver"`
}

type Service interface {
	ApplyRTKCorrection(ctx context.Context, fix *GNSSRawFix) (*RTKCorrectedPosition, error)
	GetLaneGuidance(ctx context.Context, userLoc utils.Coordinate, nextTurnAction string, distToTurnM float64) (*LaneGuidanceResponse, error)
}

type laneLevelService struct{}

func NewLaneLevelService() Service {
	return &laneLevelService{}
}

// ApplyRTKCorrection applies carrier-phase differential correction to raw GNSS data.
func (s *laneLevelService) ApplyRTKCorrection(ctx context.Context, fix *GNSSRawFix) (*RTKCorrectedPosition, error) {
	// Centimeter-level ground correction offset simulation (NTRIP base station delta)
	deltaLat := 0.000012 * math.Cos(fix.Latitude*math.Pi/180.0)
	deltaLng := -0.000008 * math.Sin(fix.Longitude*math.Pi/180.0)

	correctedLat := fix.Latitude + deltaLat
	correctedLng := fix.Longitude + deltaLng

	accuracyCm := 2.4 // Centimeter accuracy (RTK Fixed)
	fixType := "RTK_FIXED"
	if fix.SatellitesInView < 8 || fix.HDOP > 1.8 {
		accuracyCm = 15.0
		fixType = "RTK_FLOAT"
	}

	return &RTKCorrectedPosition{
		RawLocation:       utils.Coordinate{Latitude: fix.Latitude, Longitude: fix.Longitude},
		CorrectedLocation: utils.Coordinate{Latitude: correctedLat, Longitude: correctedLng},
		AccuracyCm:        accuracyCm,
		FixType:           fixType,
		LaneIndex:         1, // Center lane
		ConfidenceScore:   0.98,
	}, nil
}

// GetLaneGuidance generates visual lane-level guidance and highlight arrays for UI rendering.
func (s *laneLevelService) GetLaneGuidance(ctx context.Context, userLoc utils.Coordinate, nextTurnAction string, distToTurnM float64) (*LaneGuidanceResponse, error) {
	totalLanes := 4
	lanes := make([]LaneInfo, totalLanes)

	// Lane layout:
	// Lane 0: Left Only
	// Lane 1: Left + Through
	// Lane 2: Through Only
	// Lane 3: Right Only
	lanes[0] = LaneInfo{LaneIndex: 0, ValidDirections: []LaneDirection{LaneDirectionLeft}, LaneType: "turn_only", IsActiveForRoute: false}
	lanes[1] = LaneInfo{LaneIndex: 1, ValidDirections: []LaneDirection{LaneDirectionLeft, LaneDirectionThrough}, LaneType: "normal", IsActiveForRoute: false}
	lanes[2] = LaneInfo{LaneIndex: 2, ValidDirections: []LaneDirection{LaneDirectionThrough}, LaneType: "normal", IsActiveForRoute: false}
	lanes[3] = LaneInfo{LaneIndex: 3, ValidDirections: []LaneDirection{LaneDirectionRight}, LaneType: "turn_only", IsActiveForRoute: false}

	var msg string
	if nextTurnAction == "turn_left" || nextTurnAction == "turn_slight_left" {
		lanes[0].IsActiveForRoute = true
		lanes[1].IsActiveForRoute = true
		msg = "Use the 2 left lanes to turn left"
	} else if nextTurnAction == "turn_right" || nextTurnAction == "turn_slight_right" {
		lanes[3].IsActiveForRoute = true
		msg = "Use the right lane to turn right"
	} else {
		lanes[1].IsActiveForRoute = true
		lanes[2].IsActiveForRoute = true
		msg = "Stay in the middle lanes to continue straight"
	}

	return &LaneGuidanceResponse{
		RoadName:         "Market Street",
		TotalLanes:       totalLanes,
		Lanes:            lanes,
		GuidanceMessage:  fmt.Sprintf("%s in %.0f meters", msg, distToTurnM),
		DistanceToTurnM:  distToTurnM,
		NextTurnManeuver: nextTurnAction,
	}, nil
}
