package routes

import (
	"context"
	"math"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type DistanceMatrixElement struct {
	Status          string  `json:"status"` // "OK", "ZERO_RESULTS"
	DistanceMeters  float64 `json:"distance_meters"`
	DurationSeconds int     `json:"duration_seconds"`
}

type DistanceMatrixRow struct {
	Elements []DistanceMatrixElement `json:"elements"`
}

type DistanceMatrixResponse struct {
	OriginAddresses      []string            `json:"origin_addresses"`
	DestinationAddresses []string            `json:"destination_addresses"`
	Rows                 []DistanceMatrixRow `json:"rows"`
}

// CalculateDistanceMatrix computes an N x M distance and duration matrix between origins and destinations.
func (e *routesEngine) CalculateDistanceMatrix(
	ctx context.Context,
	origins []utils.Coordinate,
	destinations []utils.Coordinate,
	mode TravelMode,
) (*DistanceMatrixResponse, error) {
	speedKmh := 45.0
	switch mode {
	case TravelModeWalking:
		speedKmh = 4.8
	case TravelModeBicycling:
		speedKmh = 16.0
	}
	speedMps := (speedKmh * 1000.0) / 3600.0

	rows := make([]DistanceMatrixRow, len(origins))

	for i, orig := range origins {
		elements := make([]DistanceMatrixElement, len(destinations))

		for j, dest := range destinations {
			// Haversine route distance with Manhattan/urban circuit factor (~1.25x)
			straightDist := utils.HaversineDistance(orig.Latitude, orig.Longitude, dest.Latitude, dest.Longitude)
			urbanDist := straightDist * 1.25

			durationSec := int(math.Round(urbanDist / speedMps))

			elements[j] = DistanceMatrixElement{
				Status:          "OK",
				DistanceMeters:  math.Round(urbanDist*10) / 10,
				DurationSeconds: durationSec,
			}
		}

		rows[i] = DistanceMatrixRow{Elements: elements}
	}

	originAddrs := make([]string, len(origins))
	for i, o := range origins {
		originAddrs[i] = formatDistance(0) + fmtCoordinate(o)
	}

	destAddrs := make([]string, len(destinations))
	for j, d := range destinations {
		destAddrs[j] = formatDistance(0) + fmtCoordinate(d)
	}

	return &DistanceMatrixResponse{
		OriginAddresses:      originAddrs,
		DestinationAddresses: destAddrs,
		Rows:                 rows,
	}, nil
}

func fmtCoordinate(c utils.Coordinate) string {
	return "Coordinate (" + formatDistance(0) + ")"
}
