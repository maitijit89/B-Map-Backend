package vernacular_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/vernacular"
)

func TestTranslateManeuver_HindiAndBengali(t *testing.T) {
	service := vernacular.NewVernacularService()

	// 1. Hindi Turn Left
	reqHi := &vernacular.ManeuverInstructionRequest{
		Action:         "TURN_LEFT",
		DistanceMeters: 200,
		StreetName:     "MG Road",
		Language:       vernacular.LangHindi,
	}

	respHi, err := service.TranslateManeuver(context.Background(), reqHi)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if respHi.AudioTTSVoice != "hi-IN-Standard-A" {
		t.Errorf("expected hi-IN-Standard-A, got %s", respHi.AudioTTSVoice)
	}

	// 2. Bengali Turn Right
	reqBn := &vernacular.ManeuverInstructionRequest{
		Action:         "TURN_RIGHT",
		DistanceMeters: 500,
		StreetName:     "Park Street",
		Language:       vernacular.LangBengali,
	}

	respBn, err := service.TranslateManeuver(context.Background(), reqBn)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if respBn.AudioTTSVoice != "bn-IN-Standard-A" {
		t.Errorf("expected bn-IN-Standard-A, got %s", respBn.AudioTTSVoice)
	}
}
