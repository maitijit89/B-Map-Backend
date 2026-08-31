package utils

import (
	"bytes"
	"math"
)

type Coordinate struct {
	Latitude  float64 `json:"lat"`
	Longitude float64 `json:"lng"`
}

// EncodePolyline encodes a slice of coordinates into a Google Polyline format string (precision: 5 decimals).
// Optimized with pre-allocated buffer sizing to eliminate buffer growth reallocations.
func EncodePolyline(coords []Coordinate) string {
	if len(coords) == 0 {
		return ""
	}

	var buffer bytes.Buffer
	// Approximate 8 bytes per coordinate pair delta
	buffer.Grow(len(coords) * 8)

	var lastLat, lastLng int54

	for _, coord := range coords {
		lat := int54(math.Round(coord.Latitude * 1e5))
		lng := int54(math.Round(coord.Longitude * 1e5))

		dLat := lat - lastLat
		dLng := lng - lastLng

		encodeSignedNumber(&buffer, dLat)
		encodeSignedNumber(&buffer, dLng)

		lastLat = lat
		lastLng = lng
	}

	return buffer.String()
}

type int54 = int64

func encodeSignedNumber(buffer *bytes.Buffer, num int64) {
	sgnNum := num << 1
	if num < 0 {
		sgnNum = ^sgnNum
	}
	encodeUnsignedNumber(buffer, sgnNum)
}

func encodeUnsignedNumber(buffer *bytes.Buffer, num int64) {
	for num >= 0x20 {
		buffer.WriteByte(byte((0x20 | (num & 0x1f)) + 63))
		num >>= 5
	}
	buffer.WriteByte(byte(num + 63))
}

// DecodePolyline decodes a Google Polyline string into a slice of coordinates.
// Optimized with estimated slice allocation to eliminate slice appending copies.
func DecodePolyline(encoded string) []Coordinate {
	length := len(encoded)
	if length == 0 {
		return nil
	}

	// Approximate 1 coordinate per 4-5 encoded characters
	estimatedCap := length / 4
	if estimatedCap < 4 {
		estimatedCap = 4
	}

	coords := make([]Coordinate, 0, estimatedCap)
	var lat, lng int64
	var index int

	for index < length {
		// Decode latitude delta
		dLat, newIndex := decodeComponent(encoded, index)
		index = newIndex
		lat += dLat

		// Decode longitude delta
		dLng, newIndex := decodeComponent(encoded, index)
		index = newIndex
		lng += dLng

		coords = append(coords, Coordinate{
			Latitude:  float64(lat) * 1e-5,
			Longitude: float64(lng) * 1e-5,
		})
	}

	return coords
}

func decodeComponent(encoded string, index int) (int64, int) {
	var result, shift int64
	var b int64 = 0x20

	for b >= 0x20 && index < len(encoded) {
		b = int64(encoded[index]) - 63
		index++
		result |= (b & 0x1f) << shift
		shift += 5
	}

	if (result & 1) != 0 {
		return ^(result >> 1), index
	}
	return result >> 1, index
}
