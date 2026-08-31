package maps

import (
	"fmt"
)

type BoundingVolume struct {
	Box    []float64 `json:"box,omitempty"`
	Region []float64 `json:"region,omitempty"`
	Sphere []float64 `json:"sphere,omitempty"`
}

type Tile3DNode struct {
	BoundingVolume      BoundingVolume         `json:"boundingVolume"`
	GeometricError      float64                `json:"geometricError"`
	Refine              string                 `json:"refine"` // "ADD" or "REPLACE"
	Content             map[string]interface{} `json:"content,omitempty"`
	Children            []Tile3DNode           `json:"children,omitempty"`
}

type Tileset3D struct {
	Asset struct {
		Version   string `json:"version"`
		Generator string `json:"generator"`
	} `json:"asset"`
	GeometricError float64    `json:"geometricError"`
	Root           Tile3DNode `json:"root"`
}

// Generate3DTileset returns an OGC 3D Tiles JSON representation for 3D building models and terrain.
func Generate3DTileset(baseURL string, lat, lng float64) *Tileset3D {
	var tileset Tileset3D
	tileset.Asset.Version = "1.0"
	tileset.Asset.Generator = "B-Map 3D Tiles Engine v1.0"
	tileset.GeometricError = 500.0

	tileset.Root = Tile3DNode{
		BoundingVolume: BoundingVolume{
			Region: []float64{
				lng - 0.05, lat - 0.05, lng + 0.05, lat + 0.05, 0, 400,
			},
		},
		GeometricError: 200.0,
		Refine:         "REPLACE",
		Content: map[string]interface{}{
			"uri": fmt.Sprintf("%s/api/v1/maps/3d-tiles/data/b3dm_root.glb", baseURL),
		},
		Children: []Tile3DNode{
			{
				BoundingVolume: BoundingVolume{
					Region: []float64{
						lng - 0.02, lat - 0.02, lng + 0.02, lat + 0.02, 0, 300,
					},
				},
				GeometricError: 50.0,
				Refine:         "ADD",
				Content: map[string]interface{}{
					"uri": fmt.Sprintf("%s/api/v1/maps/3d-tiles/data/buildings_sub.b3dm", baseURL),
				},
			},
		},
	}

	return &tileset
}
