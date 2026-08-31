package maps_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/internal/maps"
	"github.com/maitijit89/b-map-backend/pkg/database"
)

func TestClusterMarkers_Aggregation(t *testing.T) {
	// Create 5 nearby places in San Francisco Downtown
	places := []domain.Place{
		{ID: uuid.New(), Name: "Place 1", Location: database.NewGeoPoint(37.7749, -122.4194)},
		{ID: uuid.New(), Name: "Place 2", Location: database.NewGeoPoint(37.7750, -122.4193)},
		{ID: uuid.New(), Name: "Place 3", Location: database.NewGeoPoint(37.7751, -122.4195)},
		{ID: uuid.New(), Name: "Far Place", Location: database.NewGeoPoint(37.8500, -122.3000)},
	}

	// At low zoom (e.g. zoom 10), the 3 close places should cluster together
	clusters := maps.ClusterMarkers(places, 10, 60.0)

	hasCluster := false
	for _, c := range clusters {
		if c.IsCluster && c.PointCount >= 3 {
			hasCluster = true
			break
		}
	}

	if !hasCluster {
		t.Errorf("expected nearby places to aggregate into a cluster at zoom 10")
	}
}
