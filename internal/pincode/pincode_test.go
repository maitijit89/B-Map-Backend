package pincode_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/pincode"
)

func TestParseIndianAddress_LandmarksAndPin(t *testing.T) {
	service := pincode.NewPINCodeService()

	input := "Flat 402, Near Hanuman Temple, Opposite Metro Pillar 128, Hauz Khas, New Delhi 110016"

	res, err := service.ParseIndianAddress(context.Background(), input)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if res.PINCode != "110016" {
		t.Errorf("expected PIN 110016, got %s", res.PINCode)
	}

	if res.MetroPillar == "" {
		t.Error("expected metro pillar extraction")
	}

	if len(res.Landmarks) == 0 {
		t.Error("expected landmark extraction")
	}

	if res.BestMatchPin == nil || res.BestMatchPin.District != "South Delhi" {
		t.Errorf("expected South Delhi district match, got %+v", res.BestMatchPin)
	}
}

func TestLookupPINCode(t *testing.T) {
	service := pincode.NewPINCodeService()

	info, err := service.LookupPINCode(context.Background(), "560034")
	if err != nil {
		t.Fatalf("expected nil error for Koramangala, got %v", err)
	}

	if info.State != "Karnataka" || info.PostOffice != "Koramangala S.O" {
		t.Errorf("unexpected PIN details: %+v", info)
	}
}
