package utils

import (
	"math"
)

const EarthRadiusMeters = 6371000.0

// DegreesToRadians converts degrees to radians
func DegreesToRadians(d float64) float64 {
	return d * math.Pi / 180.0
}

// RadiansToDegrees converts radians to degrees
func RadiansToDegrees(r float64) float64 {
	return r * 180.0 / math.Pi
}

// HaversineDistance calculates the great-circle distance between two coordinates in meters.
func HaversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	dLat := DegreesToRadians(lat2 - lat1)
	dLon := DegreesToRadians(lon2 - lon1)

	rLat1 := DegreesToRadians(lat1)
	rLat2 := DegreesToRadians(lat2)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Sin(dLon/2)*math.Sin(dLon/2)*math.Cos(rLat1)*math.Cos(rLat2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return EarthRadiusMeters * c
}

// HaversineDistanceCoords calculates distance between two Coordinate structs in meters.
func HaversineDistanceCoords(c1, c2 Coordinate) float64 {
	return HaversineDistance(c1.Latitude, c1.Longitude, c2.Latitude, c2.Longitude)
}

// CalculateBearing calculates the initial bearing (forward azimuth) from point 1 to point 2 in degrees [0, 360).
func CalculateBearing(lat1, lon1, lat2, lon2 float64) float64 {
	rLat1 := DegreesToRadians(lat1)
	rLat2 := DegreesToRadians(lat2)
	dLon := DegreesToRadians(lon2 - lon1)

	y := math.Sin(dLon) * math.Cos(rLat2)
	x := math.Cos(rLat1)*math.Sin(rLat2) - math.Sin(rLat1)*math.Cos(rLat2)*math.Cos(dLon)

	bearing := RadiansToDegrees(math.Atan2(y, x))
	return math.Mod(bearing+360.0, 360.0)
}

// TurnAngle calculates the angle change between two consecutive vectors (bearing1 to bearing2).
// Positive values represent right turns, negative values represent left turns.
func TurnAngle(bearing1, bearing2 float64) float64 {
	diff := bearing2 - bearing1
	for diff > 180.0 {
		diff -= 360.0
	}
	for diff < -180.0 {
		diff += 360.0
	}
	return diff
}
