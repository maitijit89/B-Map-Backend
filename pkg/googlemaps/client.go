package googlemaps

import (
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type Client interface {
	SignURL(rawURL string) (string, error)
	ForwardGeocode(ctx context.Context, address string) (*GoogleGeocodeResponse, error)
	PlaceSearch(ctx context.Context, query string, lat, lng float64) (*GooglePlacesResponse, error)
}

type googleMapsClient struct {
	cfg        *config.GoogleMapsConfig
	httpClient *http.Client
}

type GoogleGeocodeResponse struct {
	Status  string `json:"status"`
	Results []struct {
		FormattedAddress string `json:"formatted_address"`
		PlaceID          string `json:"place_id"`
		Geometry         struct {
			Location struct {
				Lat float64 `json:"lat"`
				Lng float64 `json:"lng"`
			} `json:"location"`
		} `json:"geometry"`
	} `json:"results"`
}

type GooglePlacesResponse struct {
	Status  string `json:"status"`
	Results []struct {
		Name     string `json:"name"`
		PlaceID  string `json:"place_id"`
		Vicinity string `json:"vicinity"`
		Geometry struct {
			Location struct {
				Lat float64 `json:"lat"`
				Lng float64 `json:"lng"`
			} `json:"location"`
		} `json:"geometry"`
	} `json:"results"`
}

func NewClient(cfg *config.GoogleMapsConfig) Client {
	return &googleMapsClient{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SignURL signs a Google Maps Platform URL with HMAC-SHA1 secret.
func (c *googleMapsClient) SignURL(rawURL string) (string, error) {
	if c.cfg.APISecret == "" {
		return rawURL, nil
	}

	u, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}

	pathAndQuery := u.RequestURI()

	// Base64 decode secret (supporting standard or URL safe base64)
	decodedKey, err := base64.URLEncoding.DecodeString(c.cfg.APISecret)
	if err != nil {
		decodedKey, err = base64.StdEncoding.DecodeString(c.cfg.APISecret)
		if err != nil {
			return rawURL, fmt.Errorf("invalid base64 secret: %w", err)
		}
	}

	mac := hmac.New(sha1.New, decodedKey)
	mac.Write([]byte(pathAndQuery))
	rawSig := mac.Sum(nil)
	sig := base64.URLEncoding.EncodeToString(rawSig)

	separator := "&"
	if !strings.Contains(rawURL, "?") {
		separator = "?"
	}
	return rawURL + separator + "signature=" + sig, nil
}

// ForwardGeocode executes Google Geocoding API call.
func (c *googleMapsClient) ForwardGeocode(ctx context.Context, address string) (*GoogleGeocodeResponse, error) {
	baseURL := fmt.Sprintf("https://maps.googleapis.com/maps/api/geocode/json?address=%s&key=%s",
		url.QueryEscape(address), c.cfg.APIKey)

	signedURL, err := c.SignURL(baseURL)
	if err != nil {
		signedURL = baseURL
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, signedURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result GoogleGeocodeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

// PlaceSearch executes Google Places API text search.
func (c *googleMapsClient) PlaceSearch(ctx context.Context, query string, lat, lng float64) (*GooglePlacesResponse, error) {
	apiKey := c.cfg.PlacesAPIKey
	if apiKey == "" {
		apiKey = c.cfg.APIKey
	}

	baseURL := fmt.Sprintf("https://maps.googleapis.com/maps/api/place/textsearch/json?query=%s&location=%f,%f&radius=5000&key=%s",
		url.QueryEscape(query), lat, lng, apiKey)

	signedURL, err := c.SignURL(baseURL)
	if err != nil {
		signedURL = baseURL
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, signedURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result GooglePlacesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

func parseGeoPoint(lat, lng float64) utils.Coordinate {
	return utils.Coordinate{Latitude: lat, Longitude: lng}
}
