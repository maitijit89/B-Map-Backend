package traffic

import (
	"context"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type CongestionLevel string

const (
	CongestionFreeFlow CongestionLevel = "GREEN"    // >= 85% free flow speed
	CongestionModerate CongestionLevel = "YELLOW"   // 50% - 85%
	CongestionHeavy    CongestionLevel = "RED"      // 25% - 50%
	CongestionSevere   CongestionLevel = "DARK_RED" // < 25%
)

type TelemetryPing struct {
	DeviceID  string           `json:"device_id"`
	Location  utils.Coordinate `json:"location"`
	SpeedKmh  float64          `json:"speed_kmh"`
	Heading   float64          `json:"heading"`
	Timestamp time.Time        `json:"timestamp"`
	RoadID    string           `json:"road_segment_id,omitempty"`
}

type RoadTrafficSegment struct {
	SegmentID        string           `json:"segment_id"`
	RoadName         string           `json:"road_name"`
	StartLocation    utils.Coordinate `json:"start_location"`
	EndLocation      utils.Coordinate `json:"end_location"`
	FreeFlowSpeedKmh float64          `json:"free_flow_speed_kmh"`
	CurrentSpeedKmh  float64          `json:"current_speed_kmh"`
	Congestion       CongestionLevel  `json:"congestion_level"`
	SpeedFactor      float64          `json:"speed_factor"` // current / freeflow (e.g. 0.35)
	SampleCount      int              `json:"vehicle_sample_count"`
	LastUpdated      time.Time        `json:"last_updated"`
	IsManualOverride bool             `json:"is_manual_override,omitempty"`
	IncidentNote     string           `json:"incident_note,omitempty"`
}

type ManualTrafficOverride struct {
	SegmentID        string          `json:"segment_id" binding:"required"`
	RoadName         string          `json:"road_name"`
	Congestion       CongestionLevel `json:"congestion_level" binding:"required"`
	CurrentSpeedKmh  float64         `json:"current_speed_kmh"`
	FreeFlowSpeedKmh float64         `json:"free_flow_speed_kmh"`
	IncidentNote     string          `json:"incident_note"`
	UpdatedBy        string          `json:"updated_by,omitempty"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

type Service interface {
	IngestTelemetry(ctx context.Context, pings []TelemetryPing) error
	GetTrafficSegments(ctx context.Context, lat, lng, radiusMeters float64) ([]RoadTrafficSegment, error)
	EvaluateLiveETA(ctx context.Context, routePolyline string, initialETASec int) (*LiveETAEvaluation, error)
	SetManualOverride(override ManualTrafficOverride)
	GetActiveOverrides() []ManualTrafficOverride
	DeleteOverride(segmentID string) bool
}

type LiveETAEvaluation struct {
	OriginalETASec       int                  `json:"original_eta_seconds"`
	CurrentETASec        int                  `json:"current_eta_seconds"`
	TrafficDelaySec      int                  `json:"traffic_delay_seconds"`
	OverallCongestion    CongestionLevel      `json:"overall_congestion"`
	FasterRouteAvailable bool                 `json:"faster_route_available"`
	TimeSavedSec         int                  `json:"time_saved_seconds,omitempty"`
	DetourSummary        string               `json:"detour_summary,omitempty"`
	CongestedSegments    []RoadTrafficSegment `json:"congested_segments"`
}

type trafficService struct {
	mu        sync.RWMutex
	segments  map[string]*RoadTrafficSegment
	overrides map[string]ManualTrafficOverride
}

func NewTrafficService() Service {
	s := &trafficService{
		segments:  make(map[string]*RoadTrafficSegment),
		overrides: make(map[string]ManualTrafficOverride),
	}
	s.seedDefaultTraffic()
	return s
}

func (s *trafficService) seedDefaultTraffic() {
	s.segments["seg_delhi_nh48"] = &RoadTrafficSegment{
		SegmentID:        "seg_delhi_nh48",
		RoadName:         "NH-48 Delhi-Gurgaon Expressway",
		StartLocation:    utils.Coordinate{Latitude: 28.5500, Longitude: 77.1000},
		EndLocation:      utils.Coordinate{Latitude: 28.4900, Longitude: 77.0800},
		FreeFlowSpeedKmh: 80.0,
		CurrentSpeedKmh:  32.0,
		Congestion:       CongestionHeavy,
		SpeedFactor:      0.40,
		SampleCount:      124,
		LastUpdated:      time.Now().UTC(),
	}

	s.segments["seg_yamuna_exp"] = &RoadTrafficSegment{
		SegmentID:        "seg_yamuna_exp",
		RoadName:         "Yamuna Expressway",
		StartLocation:    utils.Coordinate{Latitude: 28.3500, Longitude: 77.5300},
		EndLocation:      utils.Coordinate{Latitude: 27.8800, Longitude: 77.8500},
		FreeFlowSpeedKmh: 100.0,
		CurrentSpeedKmh:  95.0,
		Congestion:       CongestionFreeFlow,
		SpeedFactor:      0.95,
		SampleCount:      86,
		LastUpdated:      time.Now().UTC(),
	}
}

func (s *trafficService) SetManualOverride(override ManualTrafficOverride) {
	s.mu.Lock()
	defer s.mu.Unlock()

	override.UpdatedAt = time.Now().UTC()
	key := strings.ToLower(strings.TrimSpace(override.SegmentID))
	s.overrides[key] = override

	freeFlow := override.FreeFlowSpeedKmh
	if freeFlow <= 0 {
		freeFlow = 60.0
	}
	currSpeed := override.CurrentSpeedKmh
	if currSpeed <= 0 {
		switch override.Congestion {
		case CongestionFreeFlow:
			currSpeed = freeFlow * 0.9
		case CongestionModerate:
			currSpeed = freeFlow * 0.65
		case CongestionHeavy:
			currSpeed = freeFlow * 0.35
		case CongestionSevere:
			currSpeed = freeFlow * 0.15
		}
	}
	speedFactor := math.Round((currSpeed/freeFlow)*100) / 100

	roadName := override.RoadName
	if roadName == "" {
		roadName = override.SegmentID
	}

	s.segments[key] = &RoadTrafficSegment{
		SegmentID:        override.SegmentID,
		RoadName:         roadName,
		FreeFlowSpeedKmh: freeFlow,
		CurrentSpeedKmh:  currSpeed,
		Congestion:       override.Congestion,
		SpeedFactor:      speedFactor,
		SampleCount:      1,
		LastUpdated:      override.UpdatedAt,
		IsManualOverride: true,
		IncidentNote:     override.IncidentNote,
	}
}

func (s *trafficService) GetActiveOverrides() []ManualTrafficOverride {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]ManualTrafficOverride, 0, len(s.overrides))
	for _, v := range s.overrides {
		list = append(list, v)
	}
	return list
}

func (s *trafficService) DeleteOverride(segmentID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := strings.ToLower(strings.TrimSpace(segmentID))
	if _, exists := s.overrides[key]; exists {
		delete(s.overrides, key)
		delete(s.segments, key)
		return true
	}
	return false
}

func (s *trafficService) IngestTelemetry(ctx context.Context, pings []TelemetryPing) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, p := range pings {
		roadID := strings.ToLower(p.RoadID)
		if roadID == "" {
			roadID = "seg_delhi_nh48"
		}

		// Don't overwrite if manual override is active
		if _, isOverride := s.overrides[roadID]; isOverride {
			continue
		}

		if seg, exists := s.segments[roadID]; exists {
			alpha := 0.2
			seg.CurrentSpeedKmh = math.Round((alpha*p.SpeedKmh+(1-alpha)*seg.CurrentSpeedKmh)*10) / 10
			seg.SampleCount++
			seg.LastUpdated = time.Now().UTC()

			ratio := seg.CurrentSpeedKmh / seg.FreeFlowSpeedKmh
			seg.SpeedFactor = math.Round(ratio*100) / 100

			switch {
			case ratio >= 0.85:
				seg.Congestion = CongestionFreeFlow
			case ratio >= 0.50:
				seg.Congestion = CongestionModerate
			case ratio >= 0.25:
				seg.Congestion = CongestionHeavy
			default:
				seg.Congestion = CongestionSevere
			}
		}
	}

	return nil
}

func (s *trafficService) GetTrafficSegments(ctx context.Context, lat, lng, radiusMeters float64) ([]RoadTrafficSegment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []RoadTrafficSegment
	for _, seg := range s.segments {
		result = append(result, *seg)
	}
	return result, nil
}

func (s *trafficService) EvaluateLiveETA(ctx context.Context, routePolyline string, initialETASec int) (*LiveETAEvaluation, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var congested []RoadTrafficSegment
	totalDelaySec := 0

	for _, seg := range s.segments {
		if seg.Congestion == CongestionHeavy || seg.Congestion == CongestionSevere {
			congested = append(congested, *seg)
			totalDelaySec += 240 // 4 minutes extra delay
		}
	}

	currentETASec := initialETASec + totalDelaySec

	fasterRoute := false
	timeSaved := 0
	detourMsg := ""

	if totalDelaySec >= 240 {
		fasterRoute = true
		timeSaved = 210
		detourMsg = "Faster route available via NH-48 Express Lanes (saves 3.5 mins)"
	}

	return &LiveETAEvaluation{
		OriginalETASec:       initialETASec,
		CurrentETASec:        currentETASec,
		TrafficDelaySec:      totalDelaySec,
		OverallCongestion:    CongestionHeavy,
		FasterRouteAvailable: fasterRoute,
		TimeSavedSec:         timeSaved,
		DetourSummary:        detourMsg,
		CongestedSegments:    congested,
	}, nil
}
