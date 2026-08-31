package roadhazards

import (
	"context"
	"fmt"
	"time"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

// HazardType represents road conditions prevalent on Indian roadways.
type HazardType string

const (
	HazardSpeedBreaker   HazardType = "SPEED_BREAKER_UNMARKED"
	HazardWaterlogging   HazardType = "MONSOON_WATERLOGGING"
	HazardPotholeCluster HazardType = "POTHOLE_CLUSTER"
	HazardCattleOnRoad   HazardType = "CATTLE_ON_HIGHWAY"
	HazardNarrowGully    HazardType = "NARROW_GULLY_BOTTLENECK"
	HazardOpenDrainage   HazardType = "OPEN_DRAINAGE_CONSTRUCTION"
)

// RoadHazard represents an active spatial alert.
type RoadHazard struct {
	ID          string           `json:"id"`
	Type        HazardType       `json:"type"`
	Severity    string           `json:"severity"` // "LOW", "MODERATE", "CRITICAL"
	Location    utils.Coordinate `json:"location"`
	Description string           `json:"description"`
	VoicePrompt string           `json:"voice_prompt"`
	ReportedAt  time.Time        `json:"reported_at"`
	Confirmations int            `json:"confirmations_count"`
}

// HazardQueryRequest defines the user's current GPS position and heading for safety lookahead.
type HazardQueryRequest struct {
	CurrentLocation utils.Coordinate `json:"current_location"`
	LookaheadMeters float64          `json:"lookahead_meters"`
	HeadingDeg      float64          `json:"heading_degrees"`
}

type Service interface {
	GetAheadHazards(ctx context.Context, req *HazardQueryRequest) ([]RoadHazard, error)
	ReportHazard(ctx context.Context, hazard *RoadHazard) (*RoadHazard, error)
}

type hazardService struct {
	hazards []RoadHazard
}

func NewHazardService() Service {
	// Seed sample Indian road hazards
	hazards := []RoadHazard{
		{
			ID: "hz_sb_delhi_01", Type: HazardSpeedBreaker, Severity: "MODERATE",
			Location: utils.Coordinate{Latitude: 28.6150, Longitude: 77.2100},
			Description: "Unmarked high speed breaker near round-about",
			VoicePrompt: "Savdhaan: Speed breaker ahead in 60 meters. Please slow down.",
			ReportedAt: time.Now().Add(-2 * time.Hour), Confirmations: 14,
		},
		{
			ID: "hz_water_mumbai_01", Type: HazardWaterlogging, Severity: "CRITICAL",
			Location: utils.Coordinate{Latitude: 19.0178, Longitude: 72.8478}, // Hindmata, Dadar
			Description: "Monsoon waterlogging 1.5 ft water level. Low clearance vehicles avoid.",
			VoicePrompt: "Warning: Monsoon waterlogging ahead at Hindmata Dadar. Reroute recommended.",
			ReportedAt: time.Now().Add(-30 * time.Minute), Confirmations: 38,
		},
		{
			ID: "hz_pothole_blr_01", Type: HazardPotholeCluster, Severity: "MODERATE",
			Location: utils.Coordinate{Latitude: 12.9279, Longitude: 77.6271}, // Silk Board
			Description: "Deep potholes on outer lane near flyover ramp",
			VoicePrompt: "Caution: Severe potholes on left lane in 100 meters.",
			ReportedAt: time.Now().Add(-1 * time.Hour), Confirmations: 22,
		},
	}
	return &hazardService{hazards: hazards}
}

func (s *hazardService) GetAheadHazards(ctx context.Context, req *HazardQueryRequest) ([]RoadHazard, error) {
	lookahead := req.LookaheadMeters
	if lookahead <= 0 {
		lookahead = 500.0 // Default 500m lookahead
	}

	var matched []RoadHazard

	for _, h := range s.hazards {
		distMeters := utils.HaversineDistanceCoords(req.CurrentLocation, h.Location)
		if distMeters <= lookahead {
			matched = append(matched, h)
		}
	}

	return matched, nil
}

func (s *hazardService) ReportHazard(ctx context.Context, h *RoadHazard) (*RoadHazard, error) {
	h.ID = fmt.Sprintf("hz_%d", time.Now().UnixNano())
	h.ReportedAt = time.Now().UTC()
	h.Confirmations = 1

	if h.VoicePrompt == "" {
		h.VoicePrompt = fmt.Sprintf("Caution: %s reported ahead.", string(h.Type))
	}

	s.hazards = append(s.hazards, *h)
	return h, nil
}
