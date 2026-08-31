package evcharging

import (
	"context"
	"time"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type ConnectorType string

const (
	ConnectorCCS2        ConnectorType = "CCS2"         // DC Fast (Tata, MG, Hyundai, Mahindra)
	ConnectorType2       ConnectorType = "TYPE_2"       // AC Standard (Cars)
	ConnectorBharatDC001 ConnectorType = "BHARAT_DC001" // 15kW DC (Fleets, 3-Wheelers)
	ConnectorBharatAC001 ConnectorType = "BHARAT_AC001" // 3x3.3kW AC (2-Wheelers / 3-Wheelers)
	ConnectorAtherGrid   ConnectorType = "ATHER_GRID"   // Ather Energy Fast Chargers
	ConnectorBatterySwap ConnectorType = "BATTERY_SWAP" // Sun Mobility / Battery Smart / Yulu
)

type ChargingStation struct {
	ID                 string            `json:"id"`
	Name               string            `json:"name"`
	Operator           string            `json:"operator"` // "Tata Power EZ", "Jio-bp pulse", "Statiq", "Ather Grid", "Zeon"
	Address            string            `json:"address"`
	Location           utils.Coordinate  `json:"location"`
	Connectors         []ConnectorStatus `json:"connectors"`
	CostPerKWhINR      float64           `json:"cost_per_kwh_inr"`
	Is24x7             bool              `json:"is_24x7"`
	HasRestroom        bool              `json:"has_restroom"`
	HasFoodDining      bool              `json:"has_food_dining"`
	LastUpdated        time.Time         `json:"last_updated"`
}

type ConnectorStatus struct {
	Type          ConnectorType `json:"type"`
	PowerKW       float64       `json:"power_kw"` // e.g. 60kW DC, 7.4kW AC
	TotalPorts    int           `json:"total_ports"`
	AvailablePorts int          `json:"available_ports"`
	Status        string        `json:"status"` // "AVAILABLE", "OCCUPIED", "MAINTENANCE"
}

type NearbyEVQuery struct {
	Location       utils.Coordinate `json:"location"`
	RadiusKm       float64          `json:"radius_km"`
	ConnectorFilter ConnectorType   `json:"connector_filter,omitempty"`
	MinPowerKW     float64          `json:"min_power_kw,omitempty"`
}

type Service interface {
	GetNearbyStations(ctx context.Context, query *NearbyEVQuery) ([]ChargingStation, error)
	GetStationByID(ctx context.Context, id string) (*ChargingStation, error)
}

type evService struct {
	stations []ChargingStation
}

func NewEVService() Service {
	// Seed prominent Indian EV Charging Stations across key corridors
	stations := []ChargingStation{
		{
			ID: "ev_tata_cyberhub", Name: "Tata Power EZ Charge - Cyber Hub", Operator: "Tata Power EZ",
			Address: "DLF Cyber Hub, NH-48, Gurugram, Haryana 122002",
			Location: utils.Coordinate{Latitude: 28.4950, Longitude: 77.0890},
			CostPerKWhINR: 18.50, Is24x7: true, HasRestroom: true, HasFoodDining: true,
			LastUpdated: time.Now().UTC(),
			Connectors: []ConnectorStatus{
				{Type: ConnectorCCS2, PowerKW: 60.0, TotalPorts: 4, AvailablePorts: 2, Status: "AVAILABLE"},
				{Type: ConnectorType2, PowerKW: 22.0, TotalPorts: 2, AvailablePorts: 1, Status: "AVAILABLE"},
			},
		},
		{
			ID: "ev_jiobp_delhimumbai_exp", Name: "Jio-bp pulse - Delhi-Mumbai Expressway Rest Area", Operator: "Jio-bp pulse",
			Address: "Wayside Amenity KM 42, NE-4 Expressway, Haryana",
			Location: utils.Coordinate{Latitude: 28.1800, Longitude: 77.1200},
			CostPerKWhINR: 21.00, Is24x7: true, HasRestroom: true, HasFoodDining: true,
			LastUpdated: time.Now().UTC(),
			Connectors: []ConnectorStatus{
				{Type: ConnectorCCS2, PowerKW: 120.0, TotalPorts: 6, AvailablePorts: 4, Status: "AVAILABLE"},
				{Type: ConnectorCCS2, PowerKW: 60.0, TotalPorts: 4, AvailablePorts: 3, Status: "AVAILABLE"},
			},
		},
		{
			ID: "ev_ather_indiranagar", Name: "Ather Grid - Indiranagar 100ft Rd", Operator: "Ather Grid",
			Address: "100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038",
			Location: utils.Coordinate{Latitude: 12.9719, Longitude: 77.6412},
			CostPerKWhINR: 15.00, Is24x7: true, HasRestroom: false, HasFoodDining: true,
			LastUpdated: time.Now().UTC(),
			Connectors: []ConnectorStatus{
				{Type: ConnectorAtherGrid, PowerKW: 3.3, TotalPorts: 3, AvailablePorts: 2, Status: "AVAILABLE"},
				{Type: ConnectorBharatAC001, PowerKW: 3.3, TotalPorts: 2, AvailablePorts: 1, Status: "AVAILABLE"},
			},
		},
		{
			ID: "ev_statiq_bandra", Name: "Statiq EV Fast Hub - Bandra Kurla Complex", Operator: "Statiq",
			Address: "G Block, BKC, Bandra East, Mumbai, Maharashtra 400051",
			Location: utils.Coordinate{Latitude: 19.0657, Longitude: 72.8688},
			CostPerKWhINR: 19.00, Is24x7: true, HasRestroom: true, HasFoodDining: true,
			LastUpdated: time.Now().UTC(),
			Connectors: []ConnectorStatus{
				{Type: ConnectorCCS2, PowerKW: 60.0, TotalPorts: 4, AvailablePorts: 1, Status: "AVAILABLE"},
				{Type: ConnectorType2, PowerKW: 7.4, TotalPorts: 4, AvailablePorts: 3, Status: "AVAILABLE"},
			},
		},
	}
	return &evService{stations: stations}
}

func (s *evService) GetNearbyStations(ctx context.Context, q *NearbyEVQuery) ([]ChargingStation, error) {
	radiusKm := q.RadiusKm
	if radiusKm <= 0 {
		radiusKm = 25.0
	}

	var results []ChargingStation
	for _, st := range s.stations {
		dKm := utils.HaversineDistanceCoords(q.Location, st.Location) / 1000.0
		if dKm <= radiusKm {
			// Apply connector filter if requested
			if q.ConnectorFilter != "" {
				hasConnector := false
				for _, c := range st.Connectors {
					if c.Type == q.ConnectorFilter {
						hasConnector = true
						break
					}
				}
				if !hasConnector {
					continue
				}
			}
			results = append(results, st)
		}
	}

	// Fallback to top stations if none strictly in radius
	if len(results) == 0 {
		return s.stations[:2], nil
	}

	return results, nil
}

func (s *evService) GetStationByID(ctx context.Context, id string) (*ChargingStation, error) {
	for _, st := range s.stations {
		if st.ID == id {
			return &st, nil
		}
	}
	return &s.stations[0], nil
}
