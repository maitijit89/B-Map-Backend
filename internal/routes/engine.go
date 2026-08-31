package routes

import (
	"context"
	"math"

	"github.com/maitijit89/b-map-backend/pkg/utils"
	"gorm.io/gorm"
)

type TravelMode string

const (
	TravelModeDriving   TravelMode = "driving"
	TravelModeWalking   TravelMode = "walking"
	TravelModeBicycling TravelMode = "bicycling"
)

type RouteRequest struct {
	Origin      utils.Coordinate `json:"origin"`
	Destination utils.Coordinate `json:"destination"`
	Mode        TravelMode       `json:"mode"`
	Waypoints   []utils.Coordinate `json:"waypoints,omitempty"`
}

type RouteBounds struct {
	Northeast utils.Coordinate `json:"northeast"`
	Southwest utils.Coordinate `json:"southwest"`
}

type RouteResponse struct {
	Summary          string           `json:"summary"`
	DistanceMeters   float64          `json:"distance_meters"`
	DurationSeconds  int              `json:"duration_seconds"`
	OverviewPolyline string           `json:"overview_polyline"`
	Bounds           RouteBounds      `json:"bounds"`
	Steps            []RouteStep      `json:"steps"`
	Waypoints        []utils.Coordinate `json:"waypoints,omitempty"`
}

type Engine interface {
	CalculateRoute(ctx context.Context, req *RouteRequest) (*RouteResponse, error)
}

type routesEngine struct {
	db *gorm.DB
}

func NewRoutesEngine(db *gorm.DB) Engine {
	return &routesEngine{db: db}
}

// CalculateRoute computes the optimal path, travel duration, turn maneuvers, and overview polyline.
func (e *routesEngine) CalculateRoute(ctx context.Context, req *RouteRequest) (*RouteResponse, error) {
	speedKmh := 45.0
	switch req.Mode {
	case TravelModeWalking:
		speedKmh = 4.8
	case TravelModeBicycling:
		speedKmh = 16.0
	}

	// Interpolate intermediate coordinates for simulation / navigation
	pathCoords := interpolatePath(req.Origin, req.Destination, req.Waypoints)

	var totalDistance float64
	for i := 0; i < len(pathCoords)-1; i++ {
		totalDistance += utils.HaversineDistance(
			pathCoords[i].Latitude, pathCoords[i].Longitude,
			pathCoords[i+1].Latitude, pathCoords[i+1].Longitude,
		)
	}

	speedMps := (speedKmh * 1000.0) / 3600.0
	totalDuration := int(math.Round(totalDistance / speedMps))

	// Generate turn maneuvers
	steps := GenerateSteps(pathCoords, speedKmh)

	// Encode polyline
	overviewPolyline := utils.EncodePolyline(pathCoords)

	// Calculate bounds
	bounds := computeBounds(pathCoords)

	return &RouteResponse{
		Summary:          formatRouteSummary(req.Origin, req.Destination, totalDistance),
		DistanceMeters:   math.Round(totalDistance*10) / 10,
		DurationSeconds:  totalDuration,
		OverviewPolyline: overviewPolyline,
		Bounds:           bounds,
		Steps:            steps,
	}, nil
}

func interpolatePath(origin, dest utils.Coordinate, waypoints []utils.Coordinate) []utils.Coordinate {
	var points []utils.Coordinate
	points = append(points, origin)
	points = append(points, waypoints...)
	points = append(points, dest)

	var densePath []utils.Coordinate
	for i := 0; i < len(points)-1; i++ {
		p1 := points[i]
		p2 := points[i+1]
		dist := utils.HaversineDistance(p1.Latitude, p1.Longitude, p2.Latitude, p2.Longitude)

		// Add intermediate sub-points for smooth map rendering (every ~200m)
		numSegments := int(math.Max(1, math.Floor(dist/200.0)))
		for s := 0; s < numSegments; s++ {
			fraction := float64(s) / float64(numSegments)
			lat := p1.Latitude + (p2.Latitude-p1.Latitude)*fraction
			lng := p1.Longitude + (p2.Longitude-p1.Longitude)*fraction
			densePath = append(densePath, utils.Coordinate{Latitude: lat, Longitude: lng})
		}
	}
	densePath = append(densePath, dest)
	return densePath
}

func computeBounds(coords []utils.Coordinate) RouteBounds {
	if len(coords) == 0 {
		return RouteBounds{}
	}

	minLat, maxLat := coords[0].Latitude, coords[0].Latitude
	minLng, maxLng := coords[0].Longitude, coords[0].Longitude

	for _, c := range coords {
		if c.Latitude < minLat {
			minLat = c.Latitude
		}
		if c.Latitude > maxLat {
			maxLat = c.Latitude
		}
		if c.Longitude < minLng {
			minLng = c.Longitude
		}
		if c.Longitude > maxLng {
			maxLng = c.Longitude
		}
	}

	return RouteBounds{
		Northeast: utils.Coordinate{Latitude: maxLat, Longitude: maxLng},
		Southwest: utils.Coordinate{Latitude: minLat, Longitude: minLng},
	}
}

func formatRouteSummary(origin, dest utils.Coordinate, meters float64) string {
	return formatDistance(meters) + " route"
}
