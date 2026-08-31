package maps

import (
	"bytes"
	"fmt"
	"math"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type StaticMarker struct {
	Location utils.Coordinate
	Color    string
	Label    string
	Size     string
}

type StaticMapRequest struct {
	Center    utils.Coordinate
	Zoom      int
	Width     int
	Height    int
	Markers   []StaticMarker
	Path      []utils.Coordinate
	PathColor string
	Theme     MapTheme
}

// GenerateStaticMapSVG renders an SVG static map with base map geometry, markers, and polyline paths.
func GenerateStaticMapSVG(req *StaticMapRequest) []byte {
	if req.Width <= 0 {
		req.Width = 600
	}
	if req.Height <= 0 {
		req.Height = 400
	}
	if req.Zoom <= 0 {
		req.Zoom = 13
	}
	if req.PathColor == "" {
		req.PathColor = "#1a73e8" // Google blue
	}

	bgColor := "#e5e3df"
	roadColor := "#ffffff"
	waterColor := "#aadaff"

	switch req.Theme {
	case ThemeDark, ThemeNight:
		bgColor = "#1e2022"
		roadColor = "#2c2f33"
		waterColor = "#0e2a47"
	case ThemeRetro:
		bgColor = "#dfd2ae"
		roadColor = "#fbf6d8"
		waterColor = "#b4d3d4"
	}

	var buf bytes.Buffer
	buf.Grow(4096 + len(req.Path)*32 + len(req.Markers)*256)

	// SVG Header
	buf.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" style="background-color: %s;">`,
		req.Width, req.Height, req.Width, req.Height, bgColor))

	// Simulated grid roads & water elements for baseline cartography
	buf.WriteString(fmt.Sprintf(`<rect width="%d" height="%d" fill="%s"/>`, req.Width, req.Height, bgColor))
	buf.WriteString(fmt.Sprintf(`<path d="M 0 %d Q %d %d %d %d L %d %d L 0 %d Z" fill="%s" opacity="0.8"/>`,
		req.Height-80, req.Width/2, req.Height-120, req.Width, req.Height-60, req.Width, req.Height, req.Height, waterColor))

	// Draw decorative street grid
	for x := 50; x < req.Width; x += 100 {
		buf.WriteString(fmt.Sprintf(`<line x1="%d" y1="0" x2="%d" y2="%d" stroke="%s" stroke-width="4" opacity="0.6"/>`, x, x, req.Height, roadColor))
	}
	for y := 40; y < req.Height; y += 80 {
		buf.WriteString(fmt.Sprintf(`<line x1="0" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="5" opacity="0.6"/>`, y, req.Width, y, roadColor))
	}

	// Project path coordinates to pixel coordinates
	if len(req.Path) >= 2 {
		buf.WriteString(fmt.Sprintf(`<path d="M`))
		for i, pt := range req.Path {
			px, py := projectCoordToPixel(pt, req.Center, req.Zoom, req.Width, req.Height)
			if i == 0 {
				buf.WriteString(fmt.Sprintf(" %.1f,%.1f", px, py))
			} else {
				buf.WriteString(fmt.Sprintf(" L %.1f,%.1f", px, py))
			}
		}
		buf.WriteString(fmt.Sprintf(`" fill="none" stroke="%s" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`, req.PathColor))
	}

	// Render Markers
	for _, m := range req.Markers {
		px, py := projectCoordToPixel(m.Location, req.Center, req.Zoom, req.Width, req.Height)
		color := m.Color
		if color == "" {
			color = "#ea4335" // Red
		}

		// Pin drop SVG path
		buf.WriteString(fmt.Sprintf(`
			<g transform="translate(%.1f, %.1f)">
				<path d="M 0,0 C -8,-10 -12,-16 -12,-24 A 12,12 0 1,1 12,-24 C 12,-16 8,-10 0,0 Z" fill="%s" filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.4))"/>
				<circle cx="0" cy="-24" r="5" fill="#ffffff"/>
				<text x="0" y="-21" font-size="8" font-family="Arial, sans-serif" font-weight="bold" fill="#333333" text-anchor="middle">%s</text>
			</g>`, px, py, color, m.Label))
	}

	// Watermark / Brand
	buf.WriteString(fmt.Sprintf(`<text x="%d" y="%d" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#666666" opacity="0.8">B-Map</text>`,
		req.Width-45, req.Height-12))

	buf.WriteString(`</svg>`)
	return buf.Bytes()
}

func projectCoordToPixel(coord, center utils.Coordinate, zoom, width, height int) (float64, float64) {
	// Web Mercator projection to pixel coordinates
	scale := 256.0 * math.Pow(2, float64(zoom))

	centerX := (center.Longitude + 180.0) / 360.0 * scale
	centerY := (1.0 - math.Log(math.Tan(center.Latitude*math.Pi/180.0)+1.0/math.Cos(center.Latitude*math.Pi/180.0))/math.Pi) / 2.0 * scale

	pointX := (coord.Longitude + 180.0) / 360.0 * scale
	pointY := (1.0 - math.Log(math.Tan(coord.Latitude*math.Pi/180.0)+1.0/math.Cos(coord.Latitude*math.Pi/180.0))/math.Pi) / 2.0 * scale

	screenX := float64(width)/2.0 + (pointX - centerX)
	screenY := float64(height)/2.0 + (pointY - centerY)

	return screenX, screenY
}
