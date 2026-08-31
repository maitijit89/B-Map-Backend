package geoextras_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/geoextras"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestGetTimeZone(t *testing.T) {
	service := geoextras.NewGeoExtrasService()

	// Test San Francisco coordinates
	tzSF, err := service.GetTimeZone(context.Background(), 37.7749, -122.4194, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if tzSF.TimeZoneID != "America/Los_Angeles" {
		t.Errorf("expected America/Los_Angeles, got %s", tzSF.TimeZoneID)
	}

	// Test London coordinates
	tzLondon, err := service.GetTimeZone(context.Background(), 51.5074, -0.1278, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if tzLondon.TimeZoneID != "Europe/London" {
		t.Errorf("expected Europe/London, got %s", tzLondon.TimeZoneID)
	}
}

func TestGetElevation(t *testing.T) {
	service := geoextras.NewGeoExtrasService()
	coords := []utils.Coordinate{
		{Latitude: 37.7749, Longitude: -122.4194},
	}

	elevations, err := service.GetElevation(context.Background(), coords)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(elevations) != 1 {
		t.Fatalf("expected 1 elevation result, got %d", len(elevations))
	}

	if elevations[0].ElevationM <= 0 {
		t.Errorf("expected positive elevation in meters, got %f", elevations[0].ElevationM)
	}
}
