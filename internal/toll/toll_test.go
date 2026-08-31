package toll_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/toll"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestCalculateTolls_CarVsTwoWheeler(t *testing.T) {
	service := toll.NewTollService()

	// Route crossing Kherki Daula (Delhi-Jaipur NH-48)
	coords := []utils.Coordinate{
		{Latitude: 28.4595, Longitude: 77.0266}, // Gurgaon
		{Latitude: 28.4067, Longitude: 76.9854}, // Kherki Daula Toll
		{Latitude: 28.3500, Longitude: 76.9200}, // Manesar
	}

	// 1. Car Request
	carReq := &toll.TollCalculationRequest{
		RouteCoordinates: coords,
		VehicleType:      toll.ClassCarJeepVan,
		IsReturnTrip:     false,
	}

	carResp, err := service.CalculateTolls(context.Background(), carReq)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if carResp.TotalTollINR <= 0 {
		t.Errorf("expected positive toll for car, got %f", carResp.TotalTollINR)
	}

	if carResp.TotalPlazasCount == 0 {
		t.Error("expected at least 1 toll plaza crossed")
	}

	// 2. Two Wheeler Request (Should be Toll Free in India)
	bikeReq := &toll.TollCalculationRequest{
		RouteCoordinates: coords,
		VehicleType:      toll.ClassTwoWheeler,
	}

	bikeResp, err := service.CalculateTolls(context.Background(), bikeReq)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if bikeResp.TotalTollINR != 0 {
		t.Errorf("expected 0 toll for two-wheeler in India, got %f", bikeResp.TotalTollINR)
	}
}
