package routes

import (
	"fmt"
	"math"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type ManeuverType string

const (
	ManeuverDepart          ManeuverType = "depart"
	ManeuverContinue        ManeuverType = "continue"
	ManeuverTurnSlightLeft  ManeuverType = "turn_slight_left"
	ManeuverTurnLeft        ManeuverType = "turn_left"
	ManeuverTurnSharpLeft   ManeuverType = "turn_sharp_left"
	ManeuverTurnSlightRight ManeuverType = "turn_slight_right"
	ManeuverTurnRight       ManeuverType = "turn_right"
	ManeuverTurnSharpRight  ManeuverType = "turn_sharp_right"
	ManeuverUTurn           ManeuverType = "u_turn"
	ManeuverArrive          ManeuverType = "arrive"
)

type RouteStep struct {
	Instruction     string           `json:"instruction"`
	Maneuver        ManeuverType     `json:"maneuver"`
	DistanceMeters  float64          `json:"distance_meters"`
	DurationSeconds int              `json:"duration_seconds"`
	StartLocation   utils.Coordinate `json:"start_location"`
	EndLocation     utils.Coordinate `json:"end_location"`
	RoadName        string           `json:"road_name,omitempty"`
}

// GenerateSteps converts a list of path coordinates into turn-by-turn navigation steps.
func GenerateSteps(coords []utils.Coordinate, averageSpeedKmh float64) []RouteStep {
	if len(coords) < 2 {
		return nil
	}

	if averageSpeedKmh <= 0 {
		averageSpeedKmh = 40.0 // Default 40 km/h in urban streets
	}
	speedMps := (averageSpeedKmh * 1000.0) / 3600.0

	var steps []RouteStep
	var prevBearing float64

	for i := 0; i < len(coords)-1; i++ {
		start := coords[i]
		end := coords[i+1]

		segmentDist := utils.HaversineDistance(start.Latitude, start.Longitude, end.Latitude, end.Longitude)
		segmentDuration := int(math.Round(segmentDist / speedMps))
		currentBearing := utils.CalculateBearing(start.Latitude, start.Longitude, end.Latitude, end.Longitude)

		var maneuver ManeuverType
		var instruction string

		if i == 0 {
			maneuver = ManeuverDepart
			instruction = fmt.Sprintf("Head towards bearing %.0f°", currentBearing)
		} else {
			turnAngle := utils.TurnAngle(prevBearing, currentBearing)
			maneuver = determineManeuver(turnAngle)
			instruction = formatInstruction(maneuver, segmentDist)
		}

		steps = append(steps, RouteStep{
			Instruction:     instruction,
			Maneuver:        maneuver,
			DistanceMeters:  math.Round(segmentDist*10) / 10,
			DurationSeconds: segmentDuration,
			StartLocation:   start,
			EndLocation:     end,
		})

		prevBearing = currentBearing
	}

	// Final arrival step
	lastCoord := coords[len(coords)-1]
	steps = append(steps, RouteStep{
		Instruction:     "You have arrived at your destination",
		Maneuver:        ManeuverArrive,
		DistanceMeters:  0,
		DurationSeconds: 0,
		StartLocation:   lastCoord,
		EndLocation:     lastCoord,
	})

	return steps
}

func determineManeuver(angle float64) ManeuverType {
	switch {
	case angle >= -20 && angle <= 20:
		return ManeuverContinue
	case angle > 20 && angle <= 45:
		return ManeuverTurnSlightRight
	case angle > 45 && angle <= 135:
		return ManeuverTurnRight
	case angle > 135 && angle <= 170:
		return ManeuverTurnSharpRight
	case angle < -20 && angle >= -45:
		return ManeuverTurnSlightLeft
	case angle < -45 && angle >= -135:
		return ManeuverTurnLeft
	case angle < -135 && angle >= -170:
		return ManeuverTurnSharpLeft
	default:
		return ManeuverUTurn
	}
}

func formatInstruction(maneuver ManeuverType, distance float64) string {
	distStr := formatDistance(distance)
	switch maneuver {
	case ManeuverContinue:
		return fmt.Sprintf("Continue straight for %s", distStr)
	case ManeuverTurnSlightRight:
		return fmt.Sprintf("Turn slight right, continue for %s", distStr)
	case ManeuverTurnRight:
		return fmt.Sprintf("Turn right, continue for %s", distStr)
	case ManeuverTurnSharpRight:
		return fmt.Sprintf("Turn sharp right, continue for %s", distStr)
	case ManeuverTurnSlightLeft:
		return fmt.Sprintf("Turn slight left, continue for %s", distStr)
	case ManeuverTurnLeft:
		return fmt.Sprintf("Turn left, continue for %s", distStr)
	case ManeuverTurnSharpLeft:
		return fmt.Sprintf("Turn sharp left, continue for %s", distStr)
	case ManeuverUTurn:
		return "Make a U-turn when possible"
	default:
		return fmt.Sprintf("Proceed for %s", distStr)
	}
}

func formatDistance(meters float64) string {
	if meters >= 1000 {
		return fmt.Sprintf("%.1f km", meters/1000.0)
	}
	return fmt.Sprintf("%.0f meters", meters)
}
