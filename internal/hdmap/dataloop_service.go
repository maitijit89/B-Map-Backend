package hdmap

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type ObservationType string

const (
	ObsConstructionCone   ObservationType = "CONSTRUCTION_ZONE"
	ObsRoadClosure        ObservationType = "TEMPORARY_ROAD_CLOSURE"
	ObsUpdatedSpeedSign   ObservationType = "SPEED_LIMIT_SIGN_CHANGE"
	ObsPotholeHazard      ObservationType = "ROAD_SURFACE_HAZARD"
	ObsNewLaneMarking     ObservationType = "LANE_CONFIG_CHANGE"
)

type VehiclePerceptionObservation struct {
	ID               uuid.UUID        `json:"id"`
	VehicleID        string           `json:"vehicle_id"`
	Type             ObservationType  `json:"observation_type"`
	Location         utils.Coordinate `json:"location"`
	Confidence       float64          `json:"sensor_confidence"` // 0.0 - 1.0
	DetectedValue    string           `json:"detected_value,omitempty"` // e.g. "30 km/h" or "Closed"
	Timestamp        time.Time        `json:"timestamp"`
}

type HDMapChangeProposal struct {
	ProposalID       string           `json:"proposal_id"`
	Type             ObservationType  `json:"change_type"`
	Location         utils.Coordinate `json:"location"`
	AggregatedScore  float64          `json:"aggregated_confidence_score"` // 0.0 - 1.0
	Confirmations    int              `json:"vehicle_confirmation_count"`
	Status           string           `json:"status"` // "PENDING_VERIFICATION", "COMMITTED_TO_MAP", "REJECTED"
	ProposedUpdate   string           `json:"proposed_update"`
	CreatedAt        time.Time        `json:"created_at"`
}

type Service interface {
	IngestObservation(ctx context.Context, obs *VehiclePerceptionObservation) (*HDMapChangeProposal, error)
	GetActiveMapChanges(ctx context.Context, lat, lng, radiusMeters float64) ([]HDMapChangeProposal, error)
}

type hdMapDataLoopService struct{}

func NewHDMapService() Service {
	return &hdMapDataLoopService{}
}

// IngestObservation processes crowdsourced autonomous vehicle sensor observations into the map data-loop.
func (s *hdMapDataLoopService) IngestObservation(ctx context.Context, obs *VehiclePerceptionObservation) (*HDMapChangeProposal, error) {
	if obs.ID == uuid.Nil {
		obs.ID = uuid.New()
	}
	obs.Timestamp = time.Now()

	// Simulate consensus aggregation: high confidence sensor detections trigger map updates
	confirmations := 3
	aggScore := mathMin(1.0, obs.Confidence*1.1)

	status := "PENDING_VERIFICATION"
	if aggScore >= 0.85 {
		status = "COMMITTED_TO_MAP" // Auto-reconcile to routing engine
	}

	proposal := &HDMapChangeProposal{
		ProposalID:      "prop_" + obs.ID.String()[:8],
		Type:            obs.Type,
		Location:        obs.Location,
		AggregatedScore: aggScore,
		Confirmations:   confirmations,
		Status:          status,
		ProposedUpdate:  "Dynamic Road Layer: " + string(obs.Type) + " (" + obs.DetectedValue + ")",
		CreatedAt:       time.Now(),
	}

	return proposal, nil
}

// GetActiveMapChanges returns all active dynamic HD map modifications (hazards, closures, lane adjustments) in a region.
func (s *hdMapDataLoopService) GetActiveMapChanges(ctx context.Context, lat, lng, radiusMeters float64) ([]HDMapChangeProposal, error) {
	return []HDMapChangeProposal{
		{
			ProposalID:      "prop_c948a12",
			Type:            ObsConstructionCone,
			Location:        utils.Coordinate{Latitude: lat + 0.002, Longitude: lng + 0.001},
			AggregatedScore: 0.94,
			Confirmations:   12,
			Status:          "COMMITTED_TO_MAP",
			ProposedUpdate:  "Right lane closed for utility maintenance",
			CreatedAt:       time.Now().Add(-20 * time.Minute),
		},
		{
			ProposalID:      "prop_b812f55",
			Type:            ObsPotholeHazard,
			Location:        utils.Coordinate{Latitude: lat - 0.0015, Longitude: lng - 0.002},
			AggregatedScore: 0.88,
			Confirmations:   6,
			Status:          "COMMITTED_TO_MAP",
			ProposedUpdate:  "Severe road surface anomaly in center lane",
			CreatedAt:       time.Now().Add(-45 * time.Minute),
		},
	}, nil
}

func mathMin(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
