package traffic_test

import (
	"context"
	"testing"
	"time"

	"github.com/maitijit89/b-map-backend/internal/traffic"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestIngestTelemetryAndCongestion(t *testing.T) {
	service := traffic.NewTrafficService()

	// Ingest low-speed traffic pings on Market St (congested slow crawl at 10 km/h)
	pings := []traffic.TelemetryPing{
		{
			DeviceID:  "dev_01",
			Location:  utils.Coordinate{Latitude: 37.7850, Longitude: -122.4070},
			SpeedKmh:  10.0,
			Heading:   45.0,
			Timestamp: time.Now(),
			RoadID:    "seg_market_st",
		},
		{
			DeviceID:  "dev_02",
			Location:  utils.Coordinate{Latitude: 37.7852, Longitude: -122.4068},
			SpeedKmh:  12.0,
			Heading:   45.0,
			Timestamp: time.Now(),
			RoadID:    "seg_market_st",
		},
	}

	err := service.IngestTelemetry(context.Background(), pings)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	segments, err := service.GetTrafficSegments(context.Background(), 37.7850, -122.4070, 1000.0)
	if err != nil {
		t.Fatalf("unexpected error fetching segments: %v", err)
	}

	if len(segments) == 0 {
		t.Fatal("expected non-empty traffic segments")
	}
}

func TestEvaluateLiveETA_FasterDetour(t *testing.T) {
	service := traffic.NewTrafficService()

	eval, err := service.EvaluateLiveETA(context.Background(), "mock_polyline", 600)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if eval.CurrentETASec < eval.OriginalETASec {
		t.Errorf("expected current ETA >= original ETA with congestion delay")
	}

	if !eval.FasterRouteAvailable {
		t.Error("expected faster detour route to be available for heavy congestion")
	}
}
