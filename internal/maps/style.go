package maps

import (
	"fmt"
)

type MapTheme string

const (
	ThemeStandard  MapTheme = "standard"
	ThemeDark      MapTheme = "dark"
	ThemeNight     MapTheme = "night"
	ThemeRetro     MapTheme = "retro"
	ThemeSilver    MapTheme = "silver"
	ThemeAubergine MapTheme = "aubergine"
)

type LayerStyle struct {
	ID     string                 `json:"id"`
	Type   string                 `json:"type"`
	Source string                 `json:"source"`
	Paint  map[string]interface{} `json:"paint"`
}

type MapboxStyleSpec struct {
	Version int                    `json:"version"`
	Name    string                 `json:"name"`
	Center  []float64              `json:"center"`
	Zoom    int                    `json:"zoom"`
	Sources map[string]interface{} `json:"sources"`
	Layers  []LayerStyle           `json:"layers"`
}

// GenerateStyleJSON generates a Mapbox / MapLibre Style Specification v8 JSON for dynamic client rendering.
func GenerateStyleJSON(baseURL string, theme MapTheme) *MapboxStyleSpec {
	tileURL := fmt.Sprintf("%s/api/v1/tiles/{z}/{x}/{y}.mvt", baseURL)

	bgColor := "#f8f4f0"
	waterColor := "#a0c8f0"
	roadColor := "#ffffff"
	roadBorderColor := "#e0e0e0"
	textColor := "#333333"

	switch theme {
	case ThemeDark, ThemeNight:
		bgColor = "#181a1b"
		waterColor = "#0e2a47"
		roadColor = "#2c2f33"
		roadBorderColor = "#23272a"
		textColor = "#e0e0e0"
	case ThemeRetro:
		bgColor = "#dfd2ae"
		waterColor = "#b4d3d4"
		roadColor = "#fbf6d8"
		roadBorderColor = "#e9dcaf"
		textColor = "#665e49"
	case ThemeSilver:
		bgColor = "#f5f5f5"
		waterColor = "#c9c9c9"
		roadColor = "#ffffff"
		roadBorderColor = "#e5e5e5"
		textColor = "#4a4a4a"
	case ThemeAubergine:
		bgColor = "#1d2c4d"
		waterColor = "#0e1626"
		roadColor = "#2b3e6b"
		roadBorderColor = "#1a2540"
		textColor = "#8ec3b9"
	}

	return &MapboxStyleSpec{
		Version: 8,
		Name:    fmt.Sprintf("B-Map %s", theme),
		Center:  []float64{-122.4194, 37.7749},
		Zoom:    13,
		Sources: map[string]interface{}{
			"bmap_vector_source": map[string]interface{}{
				"type": "vector",
				"tiles": []string{
					tileURL,
				},
				"minzoom": 0,
				"maxzoom": 22,
			},
		},
		Layers: []LayerStyle{
			{
				ID:   "background",
				Type: "background",
				Paint: map[string]interface{}{
					"background-color": bgColor,
				},
			},
			{
				ID:     "water",
				Type:   "fill",
				Source: "bmap_vector_source",
				Paint: map[string]interface{}{
					"fill-color": waterColor,
				},
			},
			{
				ID:     "roads-case",
				Type:   "line",
				Source: "bmap_vector_source",
				Paint: map[string]interface{}{
					"line-color": roadBorderColor,
					"line-width": 4,
				},
			},
			{
				ID:     "roads",
				Type:   "line",
				Source: "bmap_vector_source",
				Paint: map[string]interface{}{
					"line-color": roadColor,
					"line-width": 2.5,
				},
			},
			// -------------------------------------------------------------
			// Official Territorial Red Borders & Mandated Lines
			// -------------------------------------------------------------
			{
				ID:     "territorial-official-red-border",
				Type:   "line",
				Source: "bmap_vector_source",
				Paint: map[string]interface{}{
					"line-color": "#d93025", // Official Red Territorial Line
					"line-width": 2.5,
					"line-opacity": 0.95,
				},
			},
			{
				ID:     "territorial-disputed-border",
				Type:   "line",
				Source: "bmap_vector_source",
				Paint: map[string]interface{}{
					"line-color": "#d93025", // Disputed Red Dashed Line
					"line-width": 2.0,
					"line-dasharray": []float64{4.0, 2.5},
				},
			},
			// -------------------------------------------------------------
			// Search Highlighting Mask & Boundary Outline Layer
			// -------------------------------------------------------------
			{
				ID:     "search-highlight-mask",
				Type:   "fill",
				Source: "bmap_vector_source",
				Paint: map[string]interface{}{
					"fill-color":   "#000000",
					"fill-opacity": 0.35, // Dims area outside the searched boundary
				},
			},
			{
				ID:     "search-highlight-stroke",
				Type:   "line",
				Source: "bmap_vector_source",
				Paint: map[string]interface{}{
					"line-color":   "#d93025",
					"line-width":   2.5,
					"line-opacity": 1.0,
				},
			},
			{
				ID:     "places-poi",
				Type:   "circle",
				Source: "bmap_vector_source",
				Paint: map[string]interface{}{
					"circle-radius":       6,
					"circle-color":        "#ff4757",
					"circle-stroke-width": 2,
					"circle-stroke-color": textColor,
				},
			},
		},
	}
}
