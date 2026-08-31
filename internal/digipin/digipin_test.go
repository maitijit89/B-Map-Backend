package digipin_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/digipin"
)

func TestEncodeCoordinates_IndiaGate(t *testing.T) {
	service := digipin.NewDIGIPINService()

	// India Gate, New Delhi
	res, err := service.EncodeCoordinates(context.Background(), 28.6129, 77.2295)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if res.DIGIPIN == "" {
		t.Error("expected non-empty DIGIPIN string")
	}

	if res.Resolution != "4m x 4m Micro-Grid (Level 10)" {
		t.Errorf("unexpected resolution: %s", res.Resolution)
	}
}
