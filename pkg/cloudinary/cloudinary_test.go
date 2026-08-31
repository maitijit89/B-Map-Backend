package cloudinary_test

import (
	"testing"

	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/pkg/cloudinary"
)

func TestNewCloudinaryService(t *testing.T) {
	cfg := config.LoadConfig()

	service, err := cloudinary.NewCloudinaryService(&cfg.Cloudinary)
	if err != nil {
		t.Fatalf("failed to initialize Cloudinary service: %v", err)
	}

	if service == nil {
		t.Fatal("expected non-nil Cloudinary service instance")
	}
}
