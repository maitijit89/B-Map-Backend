package evcharging_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/evcharging"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestGetNearbyStations_CCS2FastCharger(t *testing.T) {
	service := evcharging.NewEVService()

	// Query near Gurgaon Cyber Hub
	q := &evcharging.NearbyEVQuery{
		Location:        utils.Coordinate{Latitude: 28.4950, Longitude: 77.0890},
		RadiusKm:        10.0,
		ConnectorFilter: evcharging.ConnectorCCS2,
	}

	stations, err := service.GetNearbyStations(context.Background(), q)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if len(stations) == 0 {
		t.Fatal("expected at least 1 EV charging station near Cyber Hub")
	}

	if stations[0].CostPerKWhINR <= 0 {
		t.Errorf("expected valid pricing per kWh, got %f", stations[0].CostPerKWhINR)
	}
}
