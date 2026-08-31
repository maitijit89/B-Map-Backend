package boundaries_test

import (
	"context"
	"testing"

	"github.com/maitijit89/b-map-backend/internal/boundaries"
)

func TestGetTerritorialBorders_OfficialRedLine(t *testing.T) {
	service := boundaries.NewBoundaryService(nil)

	borders, err := service.GetTerritorialBorders(context.Background(), "GLOBAL", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(borders.Features) == 0 {
		t.Fatal("expected at least 1 boundary feature")
	}

	feat := borders.Features[0]
	props, ok := feat["properties"].(map[string]interface{})
	if !ok {
		t.Fatal("expected feature properties map")
	}

	if props["stroke_color"] != "#d93025" {
		t.Errorf("expected official red border color #d93025, got %v", props["stroke_color"])
	}
}

func TestGetRegionHighlight_InvertedMask(t *testing.T) {
	service := boundaries.NewBoundaryService(nil)

	highlight, err := service.GetRegionHighlight(context.Background(), "San Francisco", "GLOBAL")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if highlight.Name != "San Francisco" {
		t.Errorf("expected name 'San Francisco', got '%s'", highlight.Name)
	}

	if highlight.StrokeColor != "#d93025" && highlight.StrokeColor != "#1a73e8" {
		t.Errorf("unexpected stroke color: %s", highlight.StrokeColor)
	}

	if highlight.MaskPolygonJSON == nil {
		t.Error("expected non-nil inverted world mask polygon for dimming")
	}
}
