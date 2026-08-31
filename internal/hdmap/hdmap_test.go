package hdmap_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/hdmap"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestIngestObservation_MapChangeProposal(t *testing.T) {
	service := hdmap.NewHDMapService()

	obs := &hdmap.VehiclePerceptionObservation{
		ID:            uuid.New(),
		VehicleID:     "av_fleet_robotaxi_09",
		Type:          hdmap.ObsConstructionCone,
		Location:      utils.Coordinate{Latitude: 37.7749, Longitude: -122.4194},
		Confidence:    0.92,
		DetectedValue: "Right lane closed",
	}

	proposal, err := service.IngestObservation(context.Background(), obs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if proposal.AggregatedScore < 0.90 {
		t.Errorf("expected high aggregated score for high confidence sensor observation, got %f", proposal.AggregatedScore)
	}

	if proposal.Status != "COMMITTED_TO_MAP" {
		t.Errorf("expected COMMITTED_TO_MAP for >0.85 confidence, got %s", proposal.Status)
	}
}

func TestGetActiveMapChanges(t *testing.T) {
	service := hdmap.NewHDMapService()

	changes, err := service.GetActiveMapChanges(context.Background(), 37.7749, -122.4194, 1000.0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(changes) == 0 {
		t.Error("expected active dynamic HD map changes in the test area")
	}
}
