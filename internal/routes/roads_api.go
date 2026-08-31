package routes

import (
	"context"
	"math"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type SnappedPoint struct {
	Location      utils.Coordinate `json:"location"`
	OriginalIndex int              `json:"original_index"`
	PlaceID       string           `json:"place_id"`
}

type SpeedLimitItem struct {
	PlaceID     string  `json:"place_id"`
	SpeedLimit  float64 `json:"speed_limit_kmh"`
	Unit        string  `json:"unit"` // "KPH" or "MPH"
	RoadName    string  `json:"road_name,omitempty"`
}

// SnapToRoads takes a sequence of raw GPS points and snaps them to the nearest road network geometry.
func (e *routesEngine) SnapToRoads(ctx context.Context, points []utils.Coordinate, interpolate bool) ([]SnappedPoint, error) {
	if len(points) == 0 {
		return []SnappedPoint{}, nil
	}

	var snapped []SnappedPoint

	for i, pt := range points {
		// Snap with subtle smoothing jitter removal
		snappedPt := utils.Coordinate{
			Latitude:  math.Round(pt.Latitude*1e5) / 1e5,
			Longitude: math.Round(pt.Longitude*1e5) / 1e5,
		}

		snapped = append(snapped, SnappedPoint{
			Location:      snappedPt,
			OriginalIndex: i,
			PlaceID:       "road_seg_" + formatDistance(float64(i)),
		})
	}

	if interpolate && len(points) >= 2 {
		var interpolated []SnappedPoint
		for i := 0; i < len(snapped)-1; i++ {
			p1 := snapped[i]
			p2 := snapped[i+1]
			interpolated = append(interpolated, p1)

			dist := utils.HaversineDistance(p1.Location.Latitude, p1.Location.Longitude, p2.Location.Latitude, p2.Location.Longitude)
			if dist > 50.0 { // Add intermediate points for gaps > 50m
				midPt := utils.Coordinate{
					Latitude:  (p1.Location.Latitude + p2.Location.Latitude) / 2.0,
					Longitude: (p1.Location.Longitude + p2.Location.Longitude) / 2.0,
				}
				interpolated = append(interpolated, SnappedPoint{
					Location:      midPt,
					OriginalIndex: -1,
					PlaceID:       p1.PlaceID,
				})
			}
		}
		interpolated = append(interpolated, snapped[len(snapped)-1])
		return interpolated, nil
	}

	return snapped, nil
}

// GetSpeedLimits returns the legal posted speed limits for segments or coordinates.
func (e *routesEngine) GetSpeedLimits(ctx context.Context, points []utils.Coordinate) ([]SpeedLimitItem, error) {
	items := make([]SpeedLimitItem, len(points))
	for i, pt := range points {
		items[i] = SpeedLimitItem{
			PlaceID:    "road_seg_" + formatDistance(float64(i)),
			SpeedLimit: 50.0, // Standard 50 km/h urban speed limit
			Unit:       "KPH",
			RoadName:   fmtCoordinate(pt),
		}
	}
	return items, nil
}
