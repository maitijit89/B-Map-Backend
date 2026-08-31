package lanelevel_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/lanelevel"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestApplyRTKCorrection(t *testing.T) {
	service := lanelevel.NewLaneLevelService()

	fix := &lanelevel.GNSSRawFix{
		Latitude:         37.7749,
		Longitude:        -122.4194,
		AltitudeM:        15.0,
		HDOP:             0.9,
		SatellitesInView: 14,
	}

	corrected, err := service.ApplyRTKCorrection(context.Background(), fix)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if corrected.FixType != "RTK_FIXED" {
		t.Errorf("expected RTK_FIXED fix type, got %s", corrected.FixType)
	}

	if corrected.AccuracyCm > 10.0 {
		t.Errorf("expected centimeter-level accuracy (< 10cm), got %f", corrected.AccuracyCm)
	}
}

func TestGetLaneGuidance(t *testing.T) {
	service := lanelevel.NewLaneLevelService()

	loc := utils.Coordinate{Latitude: 37.7749, Longitude: -122.4194}
	guidance, err := service.GetLaneGuidance(context.Background(), loc, "turn_left", 150.0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if guidance.TotalLanes <= 0 {
		t.Errorf("expected positive total lanes, got %d", guidance.TotalLanes)
	}

	hasActive := false
	for _, l := range guidance.Lanes {
		if l.IsActiveForRoute {
			hasActive = true
			break
		}
	}

	if !hasActive {
		t.Error("expected at least one active highlighted lane for turn_left maneuver")
	}
}
