package utils_test

import (
	"math"
	"testing"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestHaversineDistance(t *testing.T) {
	// San Francisco (37.7749, -122.4194) to Oakland (37.8044, -122.2712) ~13.5 km
	dist := utils.HaversineDistance(37.7749, -122.4194, 37.8044, -122.2712)
	if dist < 13000 || dist > 14000 {
		t.Errorf("expected distance around 13.5km, got %f meters", dist)
	}
}

func TestCalculateBearing(t *testing.T) {
	// Heading North
	bearing := utils.CalculateBearing(0, 0, 10, 0)
	if math.Abs(bearing-0.0) > 0.1 && math.Abs(bearing-360.0) > 0.1 {
		t.Errorf("expected bearing 0 (North), got %f", bearing)
	}

	// Heading East
	bearingEast := utils.CalculateBearing(0, 0, 0, 10)
	if math.Abs(bearingEast-90.0) > 0.1 {
		t.Errorf("expected bearing 90 (East), got %f", bearingEast)
	}
}

func TestTurnAngle(t *testing.T) {
	// 90 degree right turn
	angle := utils.TurnAngle(0, 90)
	if math.Abs(angle-90.0) > 0.1 {
		t.Errorf("expected turn angle 90, got %f", angle)
	}

	// 90 degree left turn
	angleLeft := utils.TurnAngle(90, 0)
	if math.Abs(angleLeft - -90.0) > 0.1 {
		t.Errorf("expected turn angle -90, got %f", angleLeft)
	}
}
