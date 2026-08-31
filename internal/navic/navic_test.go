package navic_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/navic"
)

func TestProcessNavICFix_GAGANAUGMENTED(t *testing.T) {
	service := navic.NewNavICService()

	req := &navic.NavICFixRequest{
		RawLatitude:  28.6139, // New Delhi, India
		RawLongitude: 77.2090,
		RawAltitude:  216.0,
		EnableGAGAN:  true,
		Satellites: []navic.SatelliteTelemetry{
			{PRN: 1, Constellation: "NavIC", InFix: true, HealthStatus: "HEALTHY"},
			{PRN: 2, Constellation: "NavIC", InFix: true, HealthStatus: "HEALTHY"},
			{PRN: 3, Constellation: "NavIC", InFix: true, HealthStatus: "HEALTHY"},
			{PRN: 127, Constellation: "GAGAN", InFix: true, HealthStatus: "HEALTHY"},
		},
	}

	resp, err := service.ProcessNavICFix(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if resp.CoverageZone != "INDIAN_MAINLAND" {
		t.Errorf("expected INDIAN_MAINLAND coverage, got %s", resp.CoverageZone)
	}

	if resp.FixType != "GAGAN_AUGMENTED_DGPS" {
		t.Errorf("expected GAGAN_AUGMENTED_DGPS fix type, got %s", resp.FixType)
	}

	if resp.AccuracyMeters > 1.0 {
		t.Errorf("expected sub-meter accuracy with GAGAN, got %f", resp.AccuracyMeters)
	}
}

func TestGetConstellationStatus(t *testing.T) {
	service := navic.NewNavICService()

	sats, err := service.GetConstellationStatus(context.Background())
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if len(sats) < 7 {
		t.Errorf("expected at least 7 NavIC satellites, got %d", len(sats))
	}
}
