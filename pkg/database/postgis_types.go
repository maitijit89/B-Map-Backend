package database

import (
	"bytes"
	"database/sql/driver"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// GeoPoint represents a WGS 84 (SRID 4326) geographical coordinate.
type GeoPoint struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// NewGeoPoint creates a new GeoPoint from latitude and longitude.
func NewGeoPoint(lat, lng float64) GeoPoint {
	return GeoPoint{
		Latitude:  lat,
		Longitude: lng,
	}
}

// Value converts GeoPoint into a PostGIS EWKT string for database insertion.
// Note: PostGIS format is POINT(longitude latitude)
func (p GeoPoint) Value() (driver.Value, error) {
	if p.Latitude == 0 && p.Longitude == 0 {
		return nil, nil
	}
	return fmt.Sprintf("SRID=4326;POINT(%f %f)", p.Longitude, p.Latitude), nil
}

// Scan parses database PostGIS data (EWKB, WKB, or WKT) into GeoPoint.
func (p *GeoPoint) Scan(val interface{}) error {
	if val == nil {
		p.Latitude = 0
		p.Longitude = 0
		return nil
	}

	switch v := val.(type) {
	case []byte:
		return p.parseBytes(v)
	case string:
		return p.parseString(v)
	default:
		return fmt.Errorf("unsupported type for GeoPoint: %T", val)
	}
}

func (p *GeoPoint) parseString(s string) error {
	// If hex encoded EWKB string (e.g. 0101000020E6100000...)
	if len(s) >= 42 && (s[0] == '0' || s[0] == '1') {
		decoded, err := hex.DecodeString(s)
		if err == nil {
			return p.parseBytes(decoded)
		}
	}

	// Handle WKT: POINT(longitude latitude) or SRID=4326;POINT(longitude latitude)
	if idx := strings.Index(s, "POINT("); idx != -1 {
		coordsStr := s[idx+6 : len(s)-1]
		coords := strings.Fields(coordsStr)
		if len(coords) >= 2 {
			lng, err1 := strconv.ParseFloat(coords[0], 64)
			lat, err2 := strconv.ParseFloat(coords[1], 64)
			if err1 == nil && err2 == nil {
				p.Longitude = lng
				p.Latitude = lat
				return nil
			}
		}
	}

	return fmt.Errorf("unable to parse GeoPoint string: %s", s)
}

func (p *GeoPoint) parseBytes(b []byte) error {
	// If the byte array is hex-encoded string represented as []byte
	if len(b) > 40 && (b[0] == '0' || b[0] == '1') {
		decoded := make([]byte, hex.DecodedLen(len(b)))
		n, err := hex.Decode(decoded, b)
		if err == nil && n >= 21 {
			b = decoded[:n]
		}
	}

	if len(b) < 21 {
		return fmt.Errorf("invalid EWKB/WKB length: %d", len(b))
	}

	// Byte order (0: BigEndian / XDR, 1: LittleEndian / NDR)
	var byteOrder binary.ByteOrder
	if b[0] == 1 {
		byteOrder = binary.LittleEndian
	} else {
		byteOrder = binary.BigEndian
	}

	reader := bytes.NewReader(b[1:])

	var geomType uint32
	if err := binary.Read(reader, byteOrder, &geomType); err != nil {
		return err
	}

	// Mask for EWKB (0x20000000 indicates SRID flag is present)
	hasSRID := (geomType & 0x20000000) != 0
	if hasSRID {
		var srid uint32
		if err := binary.Read(reader, byteOrder, &srid); err != nil {
			return err
		}
	}

	var lng, lat float64
	if err := binary.Read(reader, byteOrder, &lng); err != nil {
		return err
	}
	if err := binary.Read(reader, byteOrder, &lat); err != nil {
		return err
	}

	p.Longitude = lng
	p.Latitude = lat
	return nil
}

// MarshalJSON serializes GeoPoint as JSON with latitude, longitude and GeoJSON compatibility.
func (p GeoPoint) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"latitude":    p.Latitude,
		"longitude":   p.Longitude,
		"coordinates": []float64{p.Longitude, p.Latitude},
	})
}
