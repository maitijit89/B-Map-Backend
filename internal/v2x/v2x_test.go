package v2x_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/v2x"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestGetIntersectionSPaT(t *testing.T) {
	service := v2x.NewV2XService()

	spat, err := service.GetIntersectionSPaT(context.Background(), "sig_test_1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if spat.TimeRemainingSec <= 0 || spat.TimeRemainingSec > 60 {
		t.Errorf("expected remaining time between 0 and 60, got %f", spat.TimeRemainingSec)
	}

	if len(spat.LaneMovements) == 0 {
		t.Error("expected non-empty lane movements")
	}
}

func TestCalculateGLOSA_SpeedAdvisory(t *testing.T) {
	service := v2x.NewV2XService()
	vehicleLoc := utils.Coordinate{Latitude: 37.7850, Longitude: -122.4060}

	advisory, err := service.CalculateGLOSA(context.Background(), vehicleLoc, 40.0, "sig_test_1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if advisory.RecommendedSpeedKmh <= 0 {
		t.Errorf("expected positive recommended speed, got %f", advisory.RecommendedSpeedKmh)
	}

	if advisory.AdvisoryMessage == "" {
		t.Error("expected non-empty advisory message")
	}
}
