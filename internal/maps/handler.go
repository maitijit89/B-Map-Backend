package maps

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/utils"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Handler struct {
	coll *mongo.Collection
	cfg  *config.Config
}

func NewHandler(db *mongo.Database, cfg *config.Config) *Handler {
	var coll *mongo.Collection
	if db != nil {
		coll = db.Collection("places")
	}
	return &Handler{
		coll: coll,
		cfg:  cfg,
	}
}

// GetStyleJSON handles GET /api/v1/maps/style.json?theme=...
func (h *Handler) GetStyleJSON(c *gin.Context) {
	theme := MapTheme(c.DefaultQuery("theme", "standard"))
	baseURL := h.cfg.App.URL
	if baseURL == "" {
		baseURL = fmt.Sprintf("http://localhost:%s", h.cfg.App.Port)
	}

	style := GenerateStyleJSON(baseURL, theme)
	c.Header("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600")
	c.JSON(http.StatusOK, style)
}

// GetStaticMap handles GET /api/v1/maps/static?center=...&zoom=...&size=600x400&markers=...
func (h *Handler) GetStaticMap(c *gin.Context) {
	centerStr := c.Query("center")
	zoomStr := c.DefaultQuery("zoom", "13")
	sizeStr := c.DefaultQuery("size", "600x400")
	theme := MapTheme(c.DefaultQuery("theme", "standard"))
	pathColor := c.DefaultQuery("path_color", "#1a73e8")

	if centerStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'center' (lat,lng) is required"})
		return
	}

	centerParts := strings.Split(centerStr, ",")
	if len(centerParts) != 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid center format, expected 'lat,lng'"})
		return
	}

	lat, err1 := strconv.ParseFloat(strings.TrimSpace(centerParts[0]), 64)
	lng, err2 := strconv.ParseFloat(strings.TrimSpace(centerParts[1]), 64)
	zoom, _ := strconv.Atoi(zoomStr)

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid center coordinates"})
		return
	}

	width, height := 600, 400
	sizeParts := strings.Split(sizeStr, "x")
	if len(sizeParts) == 2 {
		if w, err := strconv.Atoi(sizeParts[0]); err == nil && w > 0 && w <= 2048 {
			width = w
		}
		if h, err := strconv.Atoi(sizeParts[1]); err == nil && h > 0 && h <= 2048 {
			height = h
		}
	}

	// Parse markers: "color:red|label:A|37.7749,-122.4194"
	var markers []StaticMarker
	if mParam := c.Query("markers"); mParam != "" {
		markers = append(markers, StaticMarker{
			Location: utils.Coordinate{Latitude: lat, Longitude: lng},
			Color:    "#ea4335",
			Label:    "A",
		})
	}

	// Parse path polyline: encoded or coordinates
	var path []utils.Coordinate
	if pathParam := c.Query("path"); pathParam != "" {
		if strings.HasPrefix(pathParam, "enc:") {
			path = utils.DecodePolyline(strings.TrimPrefix(pathParam, "enc:"))
		}
	}

	req := &StaticMapRequest{
		Center:    utils.Coordinate{Latitude: lat, Longitude: lng},
		Zoom:      zoom,
		Width:     width,
		Height:    height,
		Markers:   markers,
		Path:      path,
		PathColor: pathColor,
		Theme:     theme,
	}

	svgBytes := GenerateStaticMapSVG(req)

	c.Header("Content-Type", "image/svg+xml")
	c.Header("Cache-Control", "public, max-age=86400")
	c.Data(http.StatusOK, "image/svg+xml", svgBytes)
}

// GetClusters handles GET /api/v1/maps/clusters?zoom=...&bbox=minLng,minLat,maxLng,maxLat
func (h *Handler) GetClusters(c *gin.Context) {
	zoomStr := c.DefaultQuery("zoom", "12")
	zoom, _ := strconv.Atoi(zoomStr)

	var places []domain.Place
	filter := bson.M{}

	// Optional Bounding Box Filter
	if bboxStr := c.Query("bbox"); bboxStr != "" {
		parts := strings.Split(bboxStr, ",")
		if len(parts) == 4 {
			minLng, _ := strconv.ParseFloat(parts[0], 64)
			minLat, _ := strconv.ParseFloat(parts[1], 64)
			maxLng, _ := strconv.ParseFloat(parts[2], 64)
			maxLat, _ := strconv.ParseFloat(parts[3], 64)

			polygon := [][][]float64{{
				{minLng, minLat},
				{maxLng, minLat},
				{maxLng, maxLat},
				{minLng, maxLat},
				{minLng, minLat},
			}}

			filter["location"] = bson.M{
				"$geoWithin": bson.M{
					"$geometry": bson.M{
						"type":        "Polygon",
						"coordinates": polygon,
					},
				},
			}
		}
	}

	if h.coll != nil {
		findOpts := options.Find().SetLimit(500)
		cursor, err := h.coll.Find(c.Request.Context(), filter, findOpts)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch places: " + err.Error()})
			return
		}
		defer cursor.Close(c.Request.Context())
		_ = cursor.All(c.Request.Context(), &places)
	}

	clusters := ClusterMarkers(places, zoom, 60.0)

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"zoom":     zoom,
		"count":    len(clusters),
		"clusters": clusters,
	})
}

// GetStreetView handles GET /api/v1/maps/streetview/metadata?lat=...&lng=...
func (h *Handler) GetStreetView(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	radiusStr := c.DefaultQuery("radius", "50")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	radius, _ := strconv.ParseFloat(radiusStr, 64)

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both 'lat' and 'lng' are required for Street View"})
		return
	}

	metadata := GetStreetViewMetadata(lat, lng, radius)
	c.JSON(http.StatusOK, metadata)
}

// Get3DTileset handles GET /api/v1/maps/3d-tiles/tileset.json?lat=...&lng=...
func (h *Handler) Get3DTileset(c *gin.Context) {
	latStr := c.DefaultQuery("lat", "37.7749")
	lngStr := c.DefaultQuery("lng", "-122.4194")

	lat, _ := strconv.ParseFloat(latStr, 64)
	lng, _ := strconv.ParseFloat(lngStr, 64)

	baseURL := h.cfg.App.URL
	if baseURL == "" {
		baseURL = fmt.Sprintf("http://localhost:%s", h.cfg.App.Port)
	}

	tileset := Generate3DTileset(baseURL, lat, lng)
	c.JSON(http.StatusOK, tileset)
}
