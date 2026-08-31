package utils_test

import (
	"math"
	"testing"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestPolyline_EncodeAndDecode(t *testing.T) {
	coords := []utils.Coordinate{
		{Latitude: 38.5, Longitude: -120.2},
		{Latitude: 40.7, Longitude: -120.95},
		{Latitude: 43.252, Longitude: -126.453},
	}

	encoded := utils.EncodePolyline(coords)
	if encoded == "" {
		t.Fatal("expected non-empty encoded polyline string")
	}

	decoded := utils.DecodePolyline(encoded)
	if len(decoded) != len(coords) {
		t.Fatalf("expected %d coordinates, got %d", len(coords), len(decoded))
	}

	for i := range coords {
		if math.Abs(coords[i].Latitude-decoded[i].Latitude) > 1e-4 {
			t.Errorf("latitude mismatch at index %d: expected %f, got %f", i, coords[i].Latitude, decoded[i].Latitude)
		}
		if math.Abs(coords[i].Longitude-decoded[i].Longitude) > 1e-4 {
			t.Errorf("longitude mismatch at index %d: expected %f, got %f", i, coords[i].Longitude, decoded[i].Longitude)
		}
	}
}
