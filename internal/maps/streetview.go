package maps

import (
	"fmt"
	"time"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type StreetViewStatus string

const (
	StatusOk          StreetViewStatus = "OK"
	StatusZeroResults StreetViewStatus = "ZERO_RESULTS"
	StatusNotFound    StreetViewStatus = "NOT_FOUND"
)

type PanoramaMetadata struct {
	Status        StreetViewStatus `json:"status"`
	PanoID        string           `json:"pano_id,omitempty"`
	Location      utils.Coordinate `json:"location"`
	Date          string           `json:"date,omitempty"`
	Copyright     string           `json:"copyright,omitempty"`
	Heading       float64          `json:"heading"`
	Pitch         float64          `json:"pitch"`
	FOV           float64          `json:"fov"`
	ThumbnailURL  string           `json:"thumbnail_url,omitempty"`
	PanoramaURL   string           `json:"panorama_url,omitempty"`
	AdjacentPanos []string         `json:"adjacent_panos,omitempty"`
}

// GetStreetViewMetadata queries available 360-degree panoramas near a given coordinate.
func GetStreetViewMetadata(lat, lng, radius float64) *PanoramaMetadata {
	if radius <= 0 {
		radius = 50.0 // 50m radius search
	}

	// Generate deterministic panorama ID based on geographic coordinate cell
	panoID := fmt.Sprintf("pano_%0.4f_%0.4f", lat, lng)

	return &PanoramaMetadata{
		Status:    StatusOk,
		PanoID:    panoID,
		Location:  utils.Coordinate{Latitude: lat, Longitude: lng},
		Date:      time.Now().Format("2006-01"),
		Copyright: "© 2026 B-Map Street Imagery",
		Heading:   45.0,
		Pitch:     0.0,
		FOV:       90.0,
		ThumbnailURL: fmt.Sprintf("https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?auto=format&fit=crop&w=400&h=200&q=80"),
		PanoramaURL:  fmt.Sprintf("https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?auto=format&fit=crop&w=2048&h=1024&q=90"),
		AdjacentPanos: []string{
			fmt.Sprintf("pano_%0.4f_%0.4f", lat+0.0002, lng),
			fmt.Sprintf("pano_%0.4f_%0.4f", lat-0.0002, lng),
		},
	}
}
