package roadhazards_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/roadhazards"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestGetAheadHazards_SpeedBreakerAlert(t *testing.T) {
	service := roadhazards.NewHazardService()

	req := &roadhazards.HazardQueryRequest{
		CurrentLocation: utils.Coordinate{Latitude: 28.6145, Longitude: 77.2095}, // ~60m from Delhi speed breaker
		LookaheadMeters: 200.0,
	}

	hazards, err := service.GetAheadHazards(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if len(hazards) == 0 {
		t.Fatal("expected at least 1 speed breaker hazard detected ahead")
	}

	if hazards[0].Type != roadhazards.HazardSpeedBreaker {
		t.Errorf("expected SPEED_BREAKER_UNMARKED, got %s", hazards[0].Type)
	}
}
