package offline_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/offline"
)

func TestCreateAndDownloadOfflineBundle(t *testing.T) {
	service := offline.NewOfflineService(nil)

	req := &offline.OfflineBundleRequest{
		Name:        "San Francisco Downtown",
		BoundingBox: [4]float64{-122.45, 37.75, -122.38, 37.81},
		MinZoom:     10,
		MaxZoom:     13,
	}

	manifest, err := service.CreateBundle(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error creating bundle: %v", err)
	}

	if manifest.BundleID == "" {
		t.Fatal("expected valid bundle ID")
	}

	if manifest.SizeBytes <= 0 {
		t.Errorf("expected positive bundle size in bytes, got %d", manifest.SizeBytes)
	}

	if manifest.SHA256Hash == "" {
		t.Error("expected non-empty SHA256 checksum")
	}

	// Test downloading binary
	binaryBytes, m2, err := service.GetBundleBinary(context.Background(), manifest.BundleID)
	if err != nil {
		t.Fatalf("unexpected error fetching binary: %v", err)
	}

	if len(binaryBytes) == 0 {
		t.Error("expected non-empty archive binary bytes")
	}

	if m2.BundleID != manifest.BundleID {
		t.Errorf("expected bundle ID %s, got %s", manifest.BundleID, m2.BundleID)
	}
}
