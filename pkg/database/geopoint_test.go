package database

import (
	"encoding/json"
	"testing"
)

func TestGeoPoint_New(t *testing.T) {
	pt := NewGeoPoint(37.7749, -122.4194)
	if pt.Type != "Point" {
		t.Errorf("expected Type to be Point, got %s", pt.Type)
	}
	if len(pt.Coordinates) != 2 || pt.Coordinates[0] != -122.4194 || pt.Coordinates[1] != 37.7749 {
		t.Errorf("expected Coordinates [-122.4194, 37.7749], got %v", pt.Coordinates)
	}
	if pt.Latitude != 37.7749 || pt.Longitude != -122.4194 {
		t.Errorf("expected lat 37.7749, lng -122.4194, got lat %f, lng %f", pt.Latitude, pt.Longitude)
	}
}

func TestGeoPoint_JSON(t *testing.T) {
	pt := NewGeoPoint(40.7128, -74.0060)

	bytes, err := json.Marshal(pt)
	if err != nil {
		t.Fatalf("failed to marshal GeoPoint: %v", err)
	}

	var unmarshaled GeoPoint
	if err := json.Unmarshal(bytes, &unmarshaled); err != nil {
		t.Fatalf("failed to unmarshal GeoPoint: %v", err)
	}

	if unmarshaled.Latitude != pt.Latitude || unmarshaled.Longitude != pt.Longitude {
		t.Errorf("unmarshaled GeoPoint mismatch: got %v, expected %v", unmarshaled, pt)
	}
	if len(unmarshaled.Coordinates) != 2 || unmarshaled.Coordinates[0] != -74.0060 || unmarshaled.Coordinates[1] != 40.7128 {
		t.Errorf("unmarshaled GeoPoint coordinates mismatch: got %v", unmarshaled.Coordinates)
	}
}

func TestGeoPoint_IsZero(t *testing.T) {
	var zeroPt GeoPoint
	if !zeroPt.IsZero() {
		t.Errorf("expected zeroPt.IsZero() to be true")
	}

	pt := NewGeoPoint(12.9716, 77.5946)
	if pt.IsZero() {
		t.Errorf("expected pt.IsZero() to be false")
	}
}
