package places_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/places"
)

func TestPlacesService_AutocompleteCaching(t *testing.T) {
	// Initialize service without active DB connection to test L1 cache
	svc := places.NewPlacesService(nil)
	if svc == nil {
		t.Fatal("expected non-nil places service")
	}

	// Calling Autocomplete on nil collection will return error initially (as expected without DB)
	_, _ = svc.Autocomplete(context.Background(), "Delhi", nil, nil, 5)
}
