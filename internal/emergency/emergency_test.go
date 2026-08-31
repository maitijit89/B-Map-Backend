package emergency_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/emergency"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestTriggerSOS_HighwayAccident(t *testing.T) {
	service := emergency.NewEmergencyService()

	req := &emergency.SOSAlertRequest{
		Type:            emergency.TypeRoadAccident,
		CurrentLocation: utils.Coordinate{Latitude: 28.4100, Longitude: 76.9900},
		VehicleNumber:   "DL-01-AB-1234",
		UserPhone:       "+91-9876543210",
		Message:         "Vehicle breakdown on NH-48",
	}

	resp, err := service.TriggerSOS(context.Background(), req)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if resp.IncidentID == "" {
		t.Error("expected non-empty incident ID")
	}

	if resp.HighwayHelpline != "1033 (NHAI Emergency)" {
		t.Errorf("unexpected helpline: %s", resp.HighwayHelpline)
	}

	if len(resp.NearbyFacilities) == 0 {
		t.Error("expected nearby emergency facilities list")
	}
}
