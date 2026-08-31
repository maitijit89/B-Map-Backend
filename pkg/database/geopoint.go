package database

import (
	"encoding/json"
	"fmt"
)

// GeoPoint represents a GeoJSON Point compatible with MongoDB 2dsphere indexing and standard JSON representations.
type GeoPoint struct {
	Type        string    `json:"type" bson:"type"`
	Coordinates []float64 `json:"coordinates" bson:"coordinates"` // [longitude, latitude]
	Latitude    float64   `json:"latitude" bson:"latitude"`
	Longitude   float64   `json:"longitude" bson:"longitude"`
}

// NewGeoPoint creates a GeoPoint from latitude and longitude.
func NewGeoPoint(lat, lng float64) GeoPoint {
	return GeoPoint{
		Type:        "Point",
		Coordinates: []float64{lng, lat},
		Latitude:    lat,
		Longitude:   lng,
	}
}

// IsZero returns true if coordinates are zero or uninitialized.
func (p GeoPoint) IsZero() bool {
	return p.Latitude == 0 && p.Longitude == 0 && (len(p.Coordinates) == 0 || (p.Coordinates[0] == 0 && p.Coordinates[1] == 0))
}

// GetLat returns the latitude coordinate.
func (p GeoPoint) GetLat() float64 {
	if p.Latitude != 0 {
		return p.Latitude
	}
	if len(p.Coordinates) >= 2 {
		return p.Coordinates[1]
	}
	return 0
}

// GetLng returns the longitude coordinate.
func (p GeoPoint) GetLng() float64 {
	if p.Longitude != 0 {
		return p.Longitude
	}
	if len(p.Coordinates) >= 1 {
		return p.Coordinates[0]
	}
	return 0
}

// String returns formatted point.
func (p GeoPoint) String() string {
	return fmt.Sprintf("Point(%.6f, %.6f)", p.GetLat(), p.GetLng())
}

// MarshalJSON custom JSON marshaler to output clean GeoJSON + lat/lng fields.
func (p GeoPoint) MarshalJSON() ([]byte, error) {
	lat := p.GetLat()
	lng := p.GetLng()
	return json.Marshal(map[string]interface{}{
		"type":        "Point",
		"coordinates": []float64{lng, lat},
		"latitude":    lat,
		"longitude":   lng,
	})
}

// UnmarshalJSON parses JSON and sets both Coordinates and Latitude/Longitude.
func (p *GeoPoint) UnmarshalJSON(data []byte) error {
	var raw struct {
		Type        string    `json:"type"`
		Coordinates []float64 `json:"coordinates"`
		Latitude    float64   `json:"latitude"`
		Longitude   float64   `json:"longitude"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	p.Type = "Point"
	if len(raw.Coordinates) >= 2 {
		p.Coordinates = []float64{raw.Coordinates[0], raw.Coordinates[1]}
		p.Longitude = raw.Coordinates[0]
		p.Latitude = raw.Coordinates[1]
	} else {
		p.Latitude = raw.Latitude
		p.Longitude = raw.Longitude
		p.Coordinates = []float64{raw.Longitude, raw.Latitude}
	}

	return nil
}
