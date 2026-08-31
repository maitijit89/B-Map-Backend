package database_test

import (
	"encoding/json"
	"testing"

	"github.com/maitijit89/b-map-backend/pkg/database"
)

func TestGeoPoint_Value(t *testing.T) {
	pt := database.NewGeoPoint(37.7749, -122.4194)
	val, err := pt.Value()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := "SRID=4326;POINT(-122.419400 37.774900)"
	if val != expected {
		t.Errorf("expected %s, got %v", expected, val)
	}
}

func TestGeoPoint_Scan_WKT(t *testing.T) {
	var pt database.GeoPoint
	wkt := "POINT(-122.4194 37.7749)"

	if err := pt.Scan(wkt); err != nil {
		t.Fatalf("failed to scan WKT string: %v", err)
	}

	if pt.Latitude != 37.7749 || pt.Longitude != -122.4194 {
		t.Errorf("unexpected coords: lat=%f, lng=%f", pt.Latitude, pt.Longitude)
	}
}

func TestGeoPoint_JSON(t *testing.T) {
	pt := database.NewGeoPoint(40.7128, -74.0060)
	bytes, err := json.Marshal(pt)
	if err != nil {
		t.Fatalf("failed to marshal GeoPoint to JSON: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(bytes, &parsed); err != nil {
		t.Fatalf("failed to unmarshal JSON output: %v", err)
	}

	if parsed["latitude"] != 40.7128 || parsed["longitude"] != -74.0060 {
		t.Errorf("unexpected JSON content: %s", string(bytes))
	}
}
