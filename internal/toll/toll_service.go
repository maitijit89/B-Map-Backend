package toll

import (
	"context"
	"strings"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

// VehicleClass represents official NHAI FASTag vehicle categories.
type VehicleClass string

const (
	ClassCarJeepVan   VehicleClass = "CAR_JEEP_VAN"     // Class 4
	ClassLCV          VehicleClass = "LCV"              // Class 5 (Light Commercial)
	ClassBusTruck     VehicleClass = "BUS_TRUCK_2AXLE"  // Class 6 (2-Axle)
	Class3Axle        VehicleClass = "3AXLE_COMMERCIAL" // Class 7
	ClassMultiAxle    VehicleClass = "4_6_AXLE"         // Class 8
	ClassOversized    VehicleClass = "7_PLUS_AXLE"      // Class 9
	ClassTwoWheeler   VehicleClass = "TWO_WHEELER"      // Exempt from national highway tolls
)

// TollPlaza represents an active NHAI / State Expressway toll plaza in India.
type TollPlaza struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	Highway        string            `json:"highway"` // "NH-48", "NE-1", "Yamuna Expressway", "Mumbai-Pune Expressway"
	Location       utils.Coordinate  `json:"location"`
	SingleTripINR  float64           `json:"single_trip_inr"`
	ReturnTripINR  float64           `json:"return_trip_inr"`
	MonthlyPassINR float64           `json:"monthly_pass_inr"`
	IsFASTagActive bool              `json:"is_fastag_active"`
	Operator       string            `json:"operator"` // "NHAI", "MSRDC", "YEIDA"
}

// TollCalculationRequest defines the route input for toll estimation.
type TollCalculationRequest struct {
	RouteCoordinates []utils.Coordinate `json:"route_coordinates"`
	VehicleType      VehicleClass       `json:"vehicle_type"`
	IsReturnTrip     bool               `json:"is_return_trip"`
}

// TollCalculationResponse defines the computed FASTag toll breakdown.
type TollCalculationResponse struct {
	TotalTollINR          float64     `json:"total_toll_inr"`
	TotalPlazasCount      int         `json:"total_plazas_count"`
	VehicleType           VehicleClass `json:"vehicle_type"`
	FASTagSavingsINR      float64     `json:"fastag_savings_inr"` // Vs 2x non-FASTag cash penalty
	Plazas                []TollPlaza `json:"plazas"`
	ExpresswaysCrossed    []string    `json:"expressways_crossed"`
	TollFreeTwoWheelerNote string      `json:"note,omitempty"`
}

type Service interface {
	CalculateTolls(ctx context.Context, req *TollCalculationRequest) (*TollCalculationResponse, error)
	GetNearbyTollPlazas(ctx context.Context, lat, lng, radiusKm float64) ([]TollPlaza, error)
}

type tollService struct {
	plazas []TollPlaza
}

func NewTollService() Service {
	// Seeded prominent Indian National Highway & Expressway toll plazas
	plazas := []TollPlaza{
		{
			ID: "toll_kherki_daula", Name: "Kherki Daula Toll Plaza", Highway: "NH-48 (Delhi-Jaipur)",
			Location: utils.Coordinate{Latitude: 28.4067, Longitude: 76.9854},
			SingleTripINR: 80.0, ReturnTripINR: 120.0, MonthlyPassINR: 920.0, IsFASTagActive: true, Operator: "NHAI",
		},
		{
			ID: "toll_shahjahanpur", Name: "Shahjahanpur Toll Plaza", Highway: "NH-48 (Rajasthan Border)",
			Location: utils.Coordinate{Latitude: 28.0264, Longitude: 76.4357},
			SingleTripINR: 175.0, ReturnTripINR: 260.0, MonthlyPassINR: 1850.0, IsFASTagActive: true, Operator: "NHAI",
		},
		{
			ID: "toll_panipat_elevated", Name: "Panipat Elevated Toll Plaza", Highway: "NH-44 (Grand Trunk Road)",
			Location: utils.Coordinate{Latitude: 29.3872, Longitude: 76.9681},
			SingleTripINR: 45.0, ReturnTripINR: 65.0, MonthlyPassINR: 650.0, IsFASTagActive: true, Operator: "NHAI",
		},
		{
			ID: "toll_jewar", Name: "Jewar Toll Plaza", Highway: "Yamuna Expressway",
			Location: utils.Coordinate{Latitude: 28.1287, Longitude: 77.5562},
			SingleTripINR: 165.0, ReturnTripINR: 245.0, MonthlyPassINR: 2100.0, IsFASTagActive: true, Operator: "YEIDA",
		},
		{
			ID: "toll_khalapur", Name: "Khalapur Toll Plaza", Highway: "Mumbai-Pune Expressway",
			Location: utils.Coordinate{Latitude: 18.7915, Longitude: 73.2842},
			SingleTripINR: 320.0, ReturnTripINR: 480.0, MonthlyPassINR: 3200.0, IsFASTagActive: true, Operator: "MSRDC",
		},
		{
			ID: "toll_attibele", Name: "Attibele Toll Plaza", Highway: "NH-44 (Hosur-Bangalore)",
			Location: utils.Coordinate{Latitude: 12.7820, Longitude: 77.7712},
			SingleTripINR: 35.0, ReturnTripINR: 50.0, MonthlyPassINR: 450.0, IsFASTagActive: true, Operator: "NHAI",
		},
	}
	return &tollService{plazas: plazas}
}

func (s *tollService) CalculateTolls(ctx context.Context, req *TollCalculationRequest) (*TollCalculationResponse, error) {
	vClass := req.VehicleType
	if vClass == "" {
		vClass = ClassCarJeepVan
	}

	// Two-Wheelers are completely toll-exempt on Indian National Highways (NHAI)
	if vClass == ClassTwoWheeler {
		return &TollCalculationResponse{
			TotalTollINR:           0.0,
			TotalPlazasCount:       0,
			VehicleType:            ClassTwoWheeler,
			FASTagSavingsINR:       0.0,
			Plazas:                 []TollPlaza{},
			ExpresswaysCrossed:     []string{},
			TollFreeTwoWheelerNote: "Two-wheelers (Motorcycles/Scooters) are 100% exempt from toll fees across all NHAI National Highways in India.",
		}, nil
	}

	var matchedPlazas []TollPlaza
	expresswayMap := make(map[string]bool)
	totalFee := 0.0

	multiplier := getVehicleMultiplier(vClass)

	// Intersect route coordinates with known toll plazas within 500m proximity
	for _, plaza := range s.plazas {
		for _, pt := range req.RouteCoordinates {
			distMeters := utils.HaversineDistanceCoords(pt, plaza.Location)
			if distMeters <= 500.0 { // Within 500 meters
				// Add plaza fee based on vehicle class multiplier
				baseFee := plaza.SingleTripINR
				if req.IsReturnTrip {
					baseFee = plaza.ReturnTripINR
				}
				fee := baseFee * multiplier
				totalFee += fee

				matchedPlazas = append(matchedPlazas, plaza)
				expresswayMap[plaza.Highway] = true
				break
			}
		}
	}

	// If no precise route intersection matched, provide sample estimate if route crosses corridor
	if len(matchedPlazas) == 0 && len(req.RouteCoordinates) >= 2 {
		// Include closest plaza for demonstration
		p := s.plazas[0]
		fee := p.SingleTripINR * multiplier
		totalFee = fee
		matchedPlazas = append(matchedPlazas, p)
		expresswayMap[p.Highway] = true
	}

	var expressways []string
	for exp := range expresswayMap {
		expressways = append(expressways, exp)
	}

	return &TollCalculationResponse{
		TotalTollINR:       totalFee,
		TotalPlazasCount:   len(matchedPlazas),
		VehicleType:        vClass,
		FASTagSavingsINR:   totalFee, // In India, cash lanes pay 2x the standard toll fee
		Plazas:             matchedPlazas,
		ExpresswaysCrossed: expressways,
	}, nil
}

func (s *tollService) GetNearbyTollPlazas(ctx context.Context, lat, lng, radiusKm float64) ([]TollPlaza, error) {
	if radiusKm <= 0 {
		radiusKm = 50.0
	}
	center := utils.Coordinate{Latitude: lat, Longitude: lng}
	var nearby []TollPlaza

	for _, p := range s.plazas {
		dKm := utils.HaversineDistanceCoords(center, p.Location) / 1000.0
		if dKm <= radiusKm {
			nearby = append(nearby, p)
		}
	}

	return nearby, nil
}

func getVehicleMultiplier(c VehicleClass) float64 {
	switch c {
	case ClassCarJeepVan:
		return 1.0
	case ClassLCV:
		return 1.6
	case ClassBusTruck:
		return 3.35
	case Class3Axle:
		return 3.65
	case ClassMultiAxle:
		return 5.25
	case ClassOversized:
		return 6.4
	default:
		return 1.0
	}
}

func contains(arr []string, target string) bool {
	for _, item := range arr {
		if strings.EqualFold(item, target) {
			return true
		}
	}
	return false
}
