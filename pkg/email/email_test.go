package email_test

import (
	"testing"

	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/pkg/email"
)

func TestSMTPService_MockFallback(t *testing.T) {
	// When credentials are empty, SendOTPEmail should gracefully fallback without crashing
	cfg := &config.SMTPConfig{
		Host:      "smtp.gmail.com",
		Port:      587,
		Username:  "",
		Password:  "",
		FromEmail: "noreply@bmap.com",
		FromName:  "B Map",
	}

	service := email.NewSMTPService(cfg)
	err := service.SendOTPEmail("test@example.com", "849201")
	if err != nil {
		t.Fatalf("expected nil error on mock fallback, got %v", err)
	}
}
