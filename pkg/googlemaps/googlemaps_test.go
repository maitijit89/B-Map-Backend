package googlemaps_test

import (
	"testing"

	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/pkg/googlemaps"
)

func TestGoogleMapsClient_SignURL(t *testing.T) {
	cfg := &config.GoogleMapsConfig{
		APIKey:    "AIzaSyC5xaYmrltiPZaNNzAwc62ULZoSXFe0IPc",
		APISecret: "ojqqznoex52Tp0KTbD8D4xbFGtk=",
	}

	client := googlemaps.NewClient(cfg)
	rawURL := "https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Pkwy,+Mountain+View,+CA&key=" + cfg.APIKey

	signedURL, err := client.SignURL(rawURL)
	if err != nil {
		t.Fatalf("unexpected error signing URL: %v", err)
	}

	if signedURL == rawURL {
		t.Error("expected signed URL to contain HMAC signature parameter")
	}
}
