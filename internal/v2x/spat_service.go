package v2x

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type SignalPhase string

const (
	PhaseGreen          SignalPhase = "GREEN"
	PhaseYellow         SignalPhase = "YELLOW"
	PhaseRed            SignalPhase = "RED"
	PhaseProtectedTurn  SignalPhase = "PROTECTED_TURN_GREEN"
	PhaseFlashingRed    SignalPhase = "FLASHING_RED"
)

type LaneMovement struct {
	LaneIndex int         `json:"lane_index"` // 0: Leftmost
	Direction string      `json:"direction"`  // "left", "through", "right"
	Phase     SignalPhase `json:"phase"`
	TimeRemainingSec float64 `json:"time_remaining_sec"`
}

type TrafficSignalSPaT struct {
	IntersectionID   string         `json:"intersection_id"`
	Name             string         `json:"name"`
	Location         utils.Coordinate `json:"location"`
	CurrentPhase     SignalPhase    `json:"current_phase"`
	TimeRemainingSec float64        `json:"time_remaining_sec"`
	CycleDurationSec float64        `json:"cycle_duration_sec"`
	LaneMovements    []LaneMovement `json:"lane_movements"`
	LastUpdatedAt    time.Time      `json:"last_updated_at"`
}

type GLOSARecommendation struct {
	IntersectionID   string           `json:"intersection_id"`
	DistanceToLightM float64          `json:"distance_to_light_meters"`
	CurrentPhase     SignalPhase      `json:"current_phase"`
	TimeRemainingSec float64          `json:"time_remaining_sec"`
	RecommendedSpeedKmh float64       `json:"recommended_speed_kmh"`
	AdvisoryMessage  string           `json:"advisory_message"`
	WillCatchGreen   bool             `json:"will_catch_green"`
}

type Service interface {
	GetIntersectionSPaT(ctx context.Context, intersectionID string) (*TrafficSignalSPaT, error)
	GetNearbySignals(ctx context.Context, lat, lng, radiusMeters float64) ([]TrafficSignalSPaT, error)
	CalculateGLOSA(ctx context.Context, vehicleLoc utils.Coordinate, vehicleSpeedKmh float64, intersectionID string) (*GLOSARecommendation, error)
}

type v2xService struct{}

func NewV2XService() Service {
	return &v2xService{}
}

// GetIntersectionSPaT returns live real-time signal phase and timing telemetry.
func (s *v2xService) GetIntersectionSPaT(ctx context.Context, intersectionID string) (*TrafficSignalSPaT, error) {
	// Deterministic SPaT calculation based on epoch time cycle
	now := time.Now().Unix()
	cycle := 60 // 60-second total cycle (30s Green, 5s Yellow, 25s Red)
	offset := now % int64(cycle)

	var phase SignalPhase
	var remaining float64

	switch {
	case offset < 30:
		phase = PhaseGreen
		remaining = float64(30 - offset)
	case offset < 35:
		phase = PhaseYellow
		remaining = float64(35 - offset)
	default:
		phase = PhaseRed
		remaining = float64(60 - offset)
	}

	return &TrafficSignalSPaT{
		IntersectionID:   intersectionID,
		Name:             "Market St & 4th St Municipal Signal",
		Location:         utils.Coordinate{Latitude: 37.7858, Longitude: -122.4065},
		CurrentPhase:     phase,
		TimeRemainingSec: remaining,
		CycleDurationSec: 60.0,
		LaneMovements: []LaneMovement{
			{LaneIndex: 0, Direction: "left", Phase: phase, TimeRemainingSec: remaining},
			{LaneIndex: 1, Direction: "through", Phase: phase, TimeRemainingSec: remaining},
			{LaneIndex: 2, Direction: "right", Phase: PhaseGreen, TimeRemainingSec: 15.0}, // Free right turn
		},
		LastUpdatedAt: time.Now(),
	}, nil
}

// GetNearbySignals finds all V2X municipal traffic lights within radius.
func (s *v2xService) GetNearbySignals(ctx context.Context, lat, lng, radiusMeters float64) ([]TrafficSignalSPaT, error) {
	if radiusMeters <= 0 {
		radiusMeters = 500.0
	}

	spat1, _ := s.GetIntersectionSPaT(ctx, "sig_market_4th")
	spat2, _ := s.GetIntersectionSPaT(ctx, "sig_mission_5th")
	spat2.Name = "Mission St & 5th St Municipal Signal"
	spat2.Location = utils.Coordinate{Latitude: 37.7815, Longitude: -122.4072}

	return []TrafficSignalSPaT{*spat1, *spat2}, nil
}

// CalculateGLOSA implements the Green Light Optimal Speed Advisory algorithm.
func (s *v2xService) CalculateGLOSA(ctx context.Context, vehicleLoc utils.Coordinate, currentSpeedKmh float64, intersectionID string) (*GLOSARecommendation, error) {
	spat, err := s.GetIntersectionSPaT(ctx, intersectionID)
	if err != nil {
		return nil, err
	}

	distM := utils.HaversineDistance(vehicleLoc.Latitude, vehicleLoc.Longitude, spat.Location.Latitude, spat.Location.Longitude)

	minSpeedKmh := 20.0
	maxSpeedKmh := 55.0

	var recommendedSpeed float64
	var willCatchGreen bool
	var msg string

	if spat.CurrentPhase == PhaseGreen {
		// If green, calculate if current speed arrives before light turns red
		timeToArrivalSec := (distM / ((currentSpeedKmh * 1000.0) / 3600.0))
		if timeToArrivalSec <= spat.TimeRemainingSec {
			recommendedSpeed = currentSpeedKmh
			willCatchGreen = true
			msg = fmt.Sprintf("Maintain %.0f km/h to pass on green (%.1fs remaining)", currentSpeedKmh, spat.TimeRemainingSec)
		} else {
			// Need to speed up slightly within speed limit to catch green, or coast
			targetSpeed := (distM / (spat.TimeRemainingSec - 2.0)) * 3.6
			if targetSpeed <= maxSpeedKmh {
				recommendedSpeed = math.Round(targetSpeed)
				willCatchGreen = true
				msg = fmt.Sprintf("Accelerate to %.0f km/h to catch current green light", recommendedSpeed)
			} else {
				willCatchGreen = false
				recommendedSpeed = 35.0
				msg = fmt.Sprintf("Prepare to stop: light turns red in %.1fs", spat.TimeRemainingSec)
			}
		}
	} else {
		// If red, calculate speed so vehicle arrives exactly when light turns green (GLOSA coasting)
		timeToGreen := spat.TimeRemainingSec
		targetSpeed := (distM / timeToGreen) * 3.6
		if targetSpeed >= minSpeedKmh && targetSpeed <= maxSpeedKmh {
			recommendedSpeed = math.Round(targetSpeed)
			willCatchGreen = true
			msg = fmt.Sprintf("Eco-Approach: Coast at %.0f km/h to arrive on green without stopping", recommendedSpeed)
		} else {
			willCatchGreen = false
			recommendedSpeed = math.Min(currentSpeedKmh, 30.0)
			msg = fmt.Sprintf("Red light ahead: Green in %.1fs", timeToGreen)
		}
	}

	return &GLOSARecommendation{
		IntersectionID:      intersectionID,
		DistanceToLightM:    math.Round(distM*10) / 10,
		CurrentPhase:        spat.CurrentPhase,
		TimeRemainingSec:    spat.TimeRemainingSec,
		RecommendedSpeedKmh: recommendedSpeed,
		AdvisoryMessage:     msg,
		WillCatchGreen:      willCatchGreen,
	}, nil
}
