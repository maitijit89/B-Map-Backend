package routes

import (
	"context"
	"fmt"
	"math"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

// SnapResult represents the result of snapping a raw GPS fix to the closest segment.
type SnapResult struct {
	OriginalLocation utils.Coordinate `json:"original_location"`
	SnappedLocation  utils.Coordinate `json:"snapped_location"`
	DistanceToRoadM  float64          `json:"distance_to_road_meters"`
	BearingDeg       float64          `json:"bearing_degrees"`
	SegmentIndex     int              `json:"segment_index"`
}

// NavigationProgress represents the real-time progress update along a route.
type NavigationProgress struct {
	SnappedLocation    utils.Coordinate `json:"snapped_location"`
	DistanceRemainingM float64          `json:"distance_remaining_meters"`
	DurationRemainingS int              `json:"duration_remaining_seconds"`
	CurrentStepIndex   int              `json:"current_step_index"`
	NextInstruction    string           `json:"next_instruction"`
	DistanceToNextStep float64          `json:"distance_to_next_step_meters"`
	IsOffRoute         bool             `json:"is_off_route"`
	HasArrived         bool             `json:"has_arrived"`
}

// SnapToRoute finds the nearest point on the route polyline to a given user GPS coordinate.
func SnapToRoute(userLocation utils.Coordinate, routeCoords []utils.Coordinate) *SnapResult {
	if len(routeCoords) < 2 {
		return &SnapResult{
			OriginalLocation: userLocation,
			SnappedLocation:  userLocation,
			DistanceToRoadM:  0,
		}
	}

	minDist := math.MaxFloat64
	bestSnap := routeCoords[0]
	bestSegmentIdx := 0
	bestBearing := 0.0

	for i := 0; i < len(routeCoords)-1; i++ {
		p1 := routeCoords[i]
		p2 := routeCoords[i+1]

		snapped, dist := closestPointOnSegment(userLocation, p1, p2)
		if dist < minDist {
			minDist = dist
			bestSnap = snapped
			bestSegmentIdx = i
			bestBearing = utils.CalculateBearing(p1.Latitude, p1.Longitude, p2.Latitude, p2.Longitude)
		}
	}

	return &SnapResult{
		OriginalLocation: userLocation,
		SnappedLocation:  bestSnap,
		DistanceToRoadM:  math.Round(minDist*10) / 10,
		BearingDeg:       math.Round(bestBearing),
		SegmentIndex:     bestSegmentIdx,
	}
}

// EvaluateProgress evaluates live progress against the active route and checks for off-route deviation.
func EvaluateProgress(
	ctx context.Context,
	engine Engine,
	userLocation utils.Coordinate,
	currentRoute *RouteResponse,
	offRouteThresholdMeters float64,
	travelMode TravelMode,
) (*NavigationProgress, *RouteResponse, error) {
	if offRouteThresholdMeters <= 0 {
		offRouteThresholdMeters = 30.0 // Default 30 meters off-route trigger
	}

	routeCoords := utils.DecodePolyline(currentRoute.OverviewPolyline)
	if len(routeCoords) < 2 {
		return nil, nil, fmt.Errorf("invalid route polyline")
	}

	snap := SnapToRoute(userLocation, routeCoords)

	// Check if user has deviated from planned route (Off-Route Trigger)
	if snap.DistanceToRoadM > offRouteThresholdMeters {
		// Auto-recalculate route from current position to destination
		dest := routeCoords[len(routeCoords)-1]
		newRoute, err := engine.CalculateRoute(ctx, &RouteRequest{
			Origin:      userLocation,
			Destination: dest,
			Mode:        travelMode,
		})
		if err != nil {
			return nil, nil, fmt.Errorf("failed to auto-reroute: %w", err)
		}

		progress := &NavigationProgress{
			SnappedLocation:    userLocation,
			DistanceRemainingM: newRoute.DistanceMeters,
			DurationRemainingS: newRoute.DurationSeconds,
			CurrentStepIndex:   0,
			NextInstruction:    newRoute.Steps[0].Instruction,
			DistanceToNextStep: newRoute.Steps[0].DistanceMeters,
			IsOffRoute:         true,
			HasArrived:         false,
		}

		return progress, newRoute, nil
	}

	// Calculate remaining distance along route from snapped segment
	var remainingDist float64
	remainingDist += utils.HaversineDistance(
		snap.SnappedLocation.Latitude, snap.SnappedLocation.Longitude,
		routeCoords[snap.SegmentIndex+1].Latitude, routeCoords[snap.SegmentIndex+1].Longitude,
	)

	for i := snap.SegmentIndex + 1; i < len(routeCoords)-1; i++ {
		remainingDist += utils.HaversineDistance(
			routeCoords[i].Latitude, routeCoords[i].Longitude,
			routeCoords[i+1].Latitude, routeCoords[i+1].Longitude,
		)
	}

	// Calculate remaining duration based on average speed
	speedMps := 12.5 // ~45 km/h
	if travelMode == TravelModeWalking {
		speedMps = 1.33 // ~4.8 km/h
	} else if travelMode == TravelModeBicycling {
		speedMps = 4.44 // ~16 km/h
	}
	remainingDuration := int(math.Round(remainingDist / speedMps))

	// Determine current step index
	currentStepIdx := int(float64(snap.SegmentIndex) / float64(len(routeCoords)) * float64(len(currentRoute.Steps)))
	if currentStepIdx >= len(currentRoute.Steps) {
		currentStepIdx = len(currentRoute.Steps) - 1
	}

	nextInstruction := "Continue on route"
	var distToNextStep float64
	if currentStepIdx < len(currentRoute.Steps) {
		nextInstruction = currentRoute.Steps[currentStepIdx].Instruction
		distToNextStep = currentRoute.Steps[currentStepIdx].DistanceMeters
	}

	hasArrived := remainingDist <= 20.0 // Arrived within 20 meters

	progress := &NavigationProgress{
		SnappedLocation:    snap.SnappedLocation,
		DistanceRemainingM: math.Round(remainingDist*10) / 10,
		DurationRemainingS: remainingDuration,
		CurrentStepIndex:   currentStepIdx,
		NextInstruction:    nextInstruction,
		DistanceToNextStep: distToNextStep,
		IsOffRoute:         false,
		HasArrived:         hasArrived,
	}

	return progress, nil, nil
}

// closestPointOnSegment projects point P onto line segment AB and returns closest point and perpendicular distance.
func closestPointOnSegment(p, a, b utils.Coordinate) (utils.Coordinate, float64) {
	// Cartesian projection approximation for small distances (< 10km)
	dx := b.Longitude - a.Longitude
	dy := b.Latitude - a.Latitude

	if dx == 0 && dy == 0 {
		return a, utils.HaversineDistance(p.Latitude, p.Longitude, a.Latitude, a.Longitude)
	}

	t := ((p.Longitude-a.Longitude)*dx + (p.Latitude-a.Latitude)*dy) / (dx*dx + dy*dy)
	t = math.Max(0, math.Min(1, t)) // Clamp to segment

	snapped := utils.Coordinate{
		Latitude:  a.Latitude + t*dy,
		Longitude: a.Longitude + t*dx,
	}

	dist := utils.HaversineDistance(p.Latitude, p.Longitude, snapped.Latitude, snapped.Longitude)
	return snapped, dist
}
