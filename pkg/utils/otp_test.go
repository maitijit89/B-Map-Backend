package utils_test

import (
	"testing"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestGenerateOTP(t *testing.T) {
	otp, err := utils.GenerateOTP(6)
	if err != nil {
		t.Fatalf("unexpected error generating OTP: %v", err)
	}

	if len(otp) != 6 {
		t.Errorf("expected OTP length 6, got %d", len(otp))
	}

	for _, c := range otp {
		if c < '0' || c > '9' {
			t.Errorf("expected digit character, got %c", c)
		}
	}
}

func TestGenerateOTP_Uniqueness(t *testing.T) {
	otps := make(map[string]bool)
	for i := 0; i < 50; i++ {
		otp, err := utils.GenerateOTP(6)
		if err != nil {
			t.Fatalf("failed to generate OTP on iteration %d: %v", i, err)
		}
		otps[otp] = true
	}

	if len(otps) < 45 {
		t.Errorf("expected at least 45 unique OTPs across 50 iterations, got %d", len(otps))
	}
}
