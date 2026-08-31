package maps

import (
	"math"

	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type ClusterPoint struct {
	ID            string           `json:"id,omitempty"`
	IsCluster     bool             `json:"is_cluster"`
	PointCount    int              `json:"point_count,omitempty"`
	Location      utils.Coordinate `json:"location"`
	ExpansionZoom int              `json:"expansion_zoom,omitempty"`
	Place         *domain.Place    `json:"place,omitempty"`
}

// ClusterMarkers performs dynamic grid-based spatial clustering for a collection of places at a given zoom level.
func ClusterMarkers(places []domain.Place, zoom int, clusterRadiusPixels float64) []ClusterPoint {
	if clusterRadiusPixels <= 0 {
		clusterRadiusPixels = 60.0 // Default 60 pixel radius
	}

	if zoom >= 17 {
		// At street level zoom, show individual markers without clustering
		result := make([]ClusterPoint, len(places))
		for i, p := range places {
			pCopy := p
			result[i] = ClusterPoint{
				ID:        p.ID.String(),
				IsCluster: false,
				Location:  utils.Coordinate{Latitude: p.Location.Latitude, Longitude: p.Location.Longitude},
				Place:     &pCopy,
			}
		}
		return result
	}

	scale := 256.0 * math.Pow(2, float64(zoom))
	gridSize := clusterRadiusPixels

	type cellKey struct {
		gx int
		gy int
	}

	cells := make(map[cellKey][]domain.Place)

	for _, p := range places {
		worldX := (p.Location.Longitude + 180.0) / 360.0 * scale
		worldY := (1.0 - math.Log(math.Tan(p.Location.Latitude*math.Pi/180.0)+1.0/math.Cos(p.Location.Latitude*math.Pi/180.0))/math.Pi) / 2.0 * scale

		gx := int(math.Floor(worldX / gridSize))
		gy := int(math.Floor(worldY / gridSize))

		key := cellKey{gx: gx, gy: gy}
		cells[key] = append(cells[key], p)
	}

	var results []ClusterPoint

	for _, cellPlaces := range cells {
		if len(cellPlaces) == 1 {
			p := cellPlaces[0]
			pCopy := p
			results = append(results, ClusterPoint{
				ID:        p.ID.String(),
				IsCluster: false,
				Location:  utils.Coordinate{Latitude: p.Location.Latitude, Longitude: p.Location.Longitude},
				Place:     &pCopy,
			})
		} else {
			// Compute centroid of cluster
			var sumLat, sumLng float64
			for _, p := range cellPlaces {
				sumLat += p.Location.Latitude
				sumLng += p.Location.Longitude
			}
			count := len(cellPlaces)
			centroid := utils.Coordinate{
				Latitude:  sumLat / float64(count),
				Longitude: sumLng / float64(count),
			}

			results = append(results, ClusterPoint{
				IsCluster:     true,
				PointCount:    count,
				Location:      centroid,
				ExpansionZoom: int(math.Min(18, float64(zoom+2))),
			})
		}
	}

	return results
}
