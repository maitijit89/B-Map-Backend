package obfuscation_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/obfuscation"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestTransformCoordinates_WGS84toGCJ02(t *testing.T) {
	service := obfuscation.NewObfuscationService()

	req := &obfuscation.TransformRequest{
		Location:    utils.Coordinate{Latitude: 39.9042, Longitude: 116.4074}, // Beijing
		SourceDatum: obfuscation.DatumWGS84,
		TargetDatum: obfuscation.DatumGCJ02,
	}

	resp, err := service.TransformCoordinates(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// GCJ-02 shift introduces hundreds of meters difference in China
	distM := utils.HaversineDistance(
		req.Location.Latitude, req.Location.Longitude,
		resp.TargetLocation.Latitude, resp.TargetLocation.Longitude,
	)

	if distM < 100.0 {
		t.Errorf("expected non-trivial GCJ-02 shift in China (> 100m), got %f meters", distM)
	}
}

func TestApplyPrivacyFuzz_DifferentialPrivacy(t *testing.T) {
	service := obfuscation.NewObfuscationService()

	loc := utils.Coordinate{Latitude: 37.7749, Longitude: -122.4194}
	fuzz, err := service.ApplyPrivacyFuzz(context.Background(), &obfuscation.FuzzRequest{
		Location:     loc,
		RadiusMeters: 200.0,
		Epsilon:      0.5,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	distM := utils.HaversineDistance(
		loc.Latitude, loc.Longitude,
		fuzz.FuzzedLocation.Latitude, fuzz.FuzzedLocation.Longitude,
	)

	if distM > 350.0 {
		t.Errorf("fuzzed location exceeded reasonable noise radius bound: %f meters", distM)
	}
}
