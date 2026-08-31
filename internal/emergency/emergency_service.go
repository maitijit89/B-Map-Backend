package emergency

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type EmergencyType string

const (
	TypeRoadAccident EmergencyType = "ACCIDENT_CRITICAL"
	TypeMedical      EmergencyType = "MEDICAL_EMERGENCY"
	TypeBreakdown    EmergencyType = "VEHICLE_BREAKDOWN"
	TypeWomenSafety  EmergencyType = "WOMEN_SAFETY_SOS"
	TypeHighwaySOS   EmergencyType = "NHAI_1033_PATROL"
)

type EmergencyFacility struct {
	ID           string           `json:"id"`
	Name         string           `json:"name"`
	Type         string           `json:"type"` // "TRAUMA_CENTER", "POLICE_STATION", "HIGHWAY_PATROL_1033", "24X7_PUNCTURE_TOWING"
	Phone        string           `json:"phone"`
	Location     utils.Coordinate `json:"location"`
	DistanceKm   float64          `json:"distance_km"`
	Is24x7       bool             `json:"is_24x7"`
	HasAmbulance bool             `json:"has_ambulance"`
}

type SOSAlertRequest struct {
	Type            EmergencyType    `json:"type" binding:"required"`
	CurrentLocation utils.Coordinate `json:"current_location" binding:"required"`
	VehicleNumber   string           `json:"vehicle_number,omitempty"`
	UserPhone       string           `json:"user_phone,omitempty"`
	Message         string           `json:"message,omitempty"`
}

type SOSAlertResponse struct {
	IncidentID       string              `json:"incident_id"`
	Status           string              `json:"status"` // "DISPATCHED", "ACKNOWLEDGED"
	NationalHelpline string              `json:"national_helpline"` // "112"
	HighwayHelpline  string              `json:"highway_helpline"`  // "1033"
	Timestamp        time.Time           `json:"timestamp"`
	NearbyFacilities []EmergencyFacility `json:"nearby_facilities"`
}

type Service interface {
	TriggerSOS(ctx context.Context, req *SOSAlertRequest) (*SOSAlertResponse, error)
	GetNearbyEmergencyFacilities(ctx context.Context, lat, lng float64) ([]EmergencyFacility, error)
}

type emergencyService struct {
	facilities []EmergencyFacility
}

func NewEmergencyService() Service {
	facilities := []EmergencyFacility{
		{
			ID: "em_aiims_trauma", Name: "AIIMS Apex Trauma Center (Level-1)", Type: "TRAUMA_CENTER",
			Phone: "+91-11-26188000", Location: utils.Coordinate{Latitude: 28.5672, Longitude: 77.2100},
			Is24x7: true, HasAmbulance: true,
		},
		{
			ID: "em_nhai_patrol_nh48", Name: "NHAI Highway Patrol Unit - NH-48 Km 34", Type: "HIGHWAY_PATROL_1033",
			Phone: "1033", Location: utils.Coordinate{Latitude: 28.4100, Longitude: 76.9900},
			Is24x7: true, HasAmbulance: true,
		},
		{
			ID: "em_police_cybercity", Name: "Gurugram Traffic Police Station", Type: "POLICE_STATION",
			Phone: "112", Location: utils.Coordinate{Latitude: 28.4980, Longitude: 77.0870},
			Is24x7: true, HasAmbulance: false,
		},
		{
			ID: "em_tow_highway", Name: "24x7 National Highway Crane & Puncture Towing", Type: "24X7_PUNCTURE_TOWING",
			Phone: "+91-9811002233", Location: utils.Coordinate{Latitude: 28.4200, Longitude: 77.0100},
			Is24x7: true, HasAmbulance: false,
		},
	}
	return &emergencyService{facilities: facilities}
}

func (s *emergencyService) TriggerSOS(ctx context.Context, req *SOSAlertRequest) (*SOSAlertResponse, error) {
	incidentID := fmt.Sprintf("sos_%s", uuid.New().String()[:8])

	facilities, _ := s.GetNearbyEmergencyFacilities(ctx, req.CurrentLocation.Latitude, req.CurrentLocation.Longitude)

	return &SOSAlertResponse{
		IncidentID:       incidentID,
		Status:           "DISPATCHED",
		NationalHelpline: "112",
		HighwayHelpline:  "1033 (NHAI Emergency)",
		Timestamp:        time.Now().UTC(),
		NearbyFacilities: facilities,
	}, nil
}

func (s *emergencyService) GetNearbyEmergencyFacilities(ctx context.Context, lat, lng float64) ([]EmergencyFacility, error) {
	curr := utils.Coordinate{Latitude: lat, Longitude: lng}
	var results []EmergencyFacility

	for _, f := range s.facilities {
		fCopy := f
		fCopy.DistanceKm = utils.HaversineDistanceCoords(curr, f.Location) / 1000.0
		results = append(results, fCopy)
	}

	return results, nil
}
