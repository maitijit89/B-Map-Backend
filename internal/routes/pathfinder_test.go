package routes_test

import (
	"testing"

	"github.com/maitijit89/b-map-backend/internal/routes"
)

func TestAStarSearch(t *testing.T) {
	// Build a simple 4-node diamond graph: 1 -> 2 -> 4, 1 -> 3 -> 4
	nodes := map[int64]*routes.GraphNode{
		1: {
			ID:        1,
			Latitude:  37.77,
			Longitude: -122.42,
			Neighbors: []routes.GraphEdge{
				{TargetNodeID: 2, LengthMeters: 500, RoadName: "Short St"},
				{TargetNodeID: 3, LengthMeters: 1000, RoadName: "Long St"},
			},
		},
		2: {
			ID:        2,
			Latitude:  37.78,
			Longitude: -122.41,
			Neighbors: []routes.GraphEdge{
				{TargetNodeID: 4, LengthMeters: 500, RoadName: "Quick Way"},
			},
		},
		3: {
			ID:        3,
			Latitude:  37.76,
			Longitude: -122.40,
			Neighbors: []routes.GraphEdge{
				{TargetNodeID: 4, LengthMeters: 1000, RoadName: "Slow Way"},
			},
		},
		4: {
			ID:        4,
			Latitude:  37.79,
			Longitude: -122.39,
			Neighbors: []routes.GraphEdge{},
		},
	}

	path, distance, found := routes.AStarSearch(nodes, 1, 4)
	if !found {
		t.Fatal("expected path to be found, got false")
	}

	if distance != 1000 {
		t.Errorf("expected shortest distance 1000m via node 2, got %f", distance)
	}

	if len(path) != 3 || path[0] != 1 || path[1] != 2 || path[2] != 4 {
		t.Errorf("unexpected path: %v", path)
	}
}
