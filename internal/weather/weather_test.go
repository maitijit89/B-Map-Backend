package weather_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/weather"
)

func TestGetHighwayWeather_YamunaExpresswayDenseFog(t *testing.T) {
	service := weather.NewWeatherService()

	// Yamuna Expressway early morning
	report, err := service.GetHighwayWeather(context.Background(), 28.1287, 77.5562, "Yamuna Expressway")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if !report.IsDenseFog {
		t.Error("expected dense fog active on Yamuna Expressway")
	}

	if report.VisibilityMeters > 50.0 {
		t.Errorf("expected low visibility, got %f", report.VisibilityMeters)
	}
}
