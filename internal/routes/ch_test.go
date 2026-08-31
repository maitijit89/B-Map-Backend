package routes_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/routes"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestContractionHierarchies_QueryCH(t *testing.T) {
	ch := routes.NewCHGraph()

	// Build a small 4-node diamond graph:
	// 1 -> 2 (w: 5), 1 -> 3 (w: 2)
	// 2 -> 4 (w: 5), 3 -> 4 (w: 2)
	// Node 3 is contracted earlier (rank 1), node 4 highest (rank 4)
	ch.AddNode(1, utils.Coordinate{Latitude: 37.7, Longitude: -122.4}, 2)
	ch.AddNode(2, utils.Coordinate{Latitude: 37.8, Longitude: -122.4}, 3)
	ch.AddNode(3, utils.Coordinate{Latitude: 37.75, Longitude: -122.35}, 1)
	ch.AddNode(4, utils.Coordinate{Latitude: 37.85, Longitude: -122.35}, 4)

	ch.AddEdge(1, 2, 5.0)
	ch.AddEdge(2, 4, 5.0)
	ch.AddEdge(1, 3, 2.0)
	ch.AddEdge(3, 4, 2.0)

	// Add shortcut for contracted node 3: 1 -> 4 with weight 4.0
	ch.AddShortcut(1, 4, 3, 4.0)

	dist, path := ch.QueryCH(context.Background(), 1, 4)
	if dist != 4.0 {
		t.Fatalf("expected shortest distance 4.0 via shortcut/node 3, got %f", dist)
	}

	if len(path) == 0 {
		t.Fatal("expected non-empty CH path")
	}
}

func TestTransitRouting_CalculateTransitRoute(t *testing.T) {
	origin := utils.Coordinate{Latitude: 37.7749, Longitude: -122.4194}
	dest := utils.Coordinate{Latitude: 37.7955, Longitude: -122.3937}

	plan, err := routes.CalculateTransitRoute(context.Background(), origin, dest)
	if err != nil {
		t.Fatalf("unexpected transit routing error: %v", err)
	}

	if len(plan.Legs) < 2 {
		t.Fatalf("expected at least 2 legs (walk + transit), got %d", len(plan.Legs))
	}

	if plan.TotalDurationSec <= 0 {
		t.Errorf("expected positive total duration, got %d", plan.TotalDurationSec)
	}
}
