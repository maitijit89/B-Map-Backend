package environment_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/environment"
)

func TestGetAirQuality(t *testing.T) {
	service := environment.NewEnvironmentService()

	aqi, err := service.GetAirQuality(context.Background(), 37.7749, -122.4194)
	if err != nil {
		t.Fatalf("unexpected error fetching AQI: %v", err)
	}

	if aqi.AQI < 0 || aqi.AQI > 500 {
		t.Errorf("expected AQI between 0 and 500, got %d", aqi.AQI)
	}

	if len(aqi.Pollutants) == 0 {
		t.Error("expected non-empty pollutants array")
	}
}

func TestGetSolarPotential(t *testing.T) {
	service := environment.NewEnvironmentService()

	solar, err := service.GetSolarPotential(context.Background(), 37.7749, -122.4194)
	if err != nil {
		t.Fatalf("unexpected error fetching solar potential: %v", err)
	}

	if solar.AnnualEnergyKWh <= 0 {
		t.Errorf("expected positive annual energy kWh, got %f", solar.AnnualEnergyKWh)
	}
}
