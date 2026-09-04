package fare_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/fare"
)

func TestEstimateFares_DelhiAutoAndCab(t *testing.T) {
	service := fare.NewFareService()

	req := &fare.FareEstimateRequest{
		City:            fare.CityDelhi,
		DistanceKm:      10.0,
		DurationMinutes: 25,
		IsNightTime:     false,
	}

	resp, err := service.EstimateFares(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if len(resp.Fares) == 0 {
		t.Fatal("expected at least 1 fare option")
	}

	// Delhi Auto: Base 30 + (8.5 * 11) = 30 + 93.5 = 123.5 -> ~124 INR (or ~154 INR with night surcharge)
	autoFare := resp.Fares[0]
	if autoFare.TotalEstimated <= 100 || autoFare.TotalEstimated >= 180 {
		t.Errorf("unexpected Delhi auto fare calculation: %f", autoFare.TotalEstimated)
	}
}
