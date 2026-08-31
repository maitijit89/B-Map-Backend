package geoextras

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// Geolocation handles POST /api/v1/geolocation
func (h *Handler) Geolocation(c *gin.Context) {
	var req GeolocationRequest
	_ = c.ShouldBindJSON(&req)

	if req.IPAddress == "" {
		req.IPAddress = c.ClientIP()
	}

	result, err := h.service.EstimateLocation(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Geolocation failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetElevation handles GET /api/v1/elevation?locations=lat,lng|lat,lng
func (h *Handler) GetElevation(c *gin.Context) {
	locationsStr := c.Query("locations")
	if locationsStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'locations' is required"})
		return
	}

	var coords []utils.Coordinate
	for _, loc := range strings.Split(locationsStr, "|") {
		parts := strings.Split(strings.TrimSpace(loc), ",")
		if len(parts) == 2 {
			lat, err1 := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
			lng, err2 := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
			if err1 == nil && err2 == nil {
				coords = append(coords, utils.Coordinate{Latitude: lat, Longitude: lng})
			}
		}
	}

	if len(coords) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid coordinates found in 'locations'"})
		return
	}

	results, err := h.service.GetElevation(c.Request.Context(), coords)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get elevation: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "OK",
		"results": results,
	})
}

// GetTimeZone handles GET /api/v1/timezone?location=lat,lng&timestamp=...
func (h *Handler) GetTimeZone(c *gin.Context) {
	locStr := c.Query("location")
	timestampStr := c.DefaultQuery("timestamp", "0")

	if locStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'location' (lat,lng) is required"})
		return
	}

	parts := strings.Split(locStr, ",")
	if len(parts) != 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid location format, expected 'lat,lng'"})
		return
	}

	lat, err1 := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
	lng, err2 := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
	timestamp, _ := strconv.ParseInt(timestampStr, 10, 64)

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid latitude/longitude"})
		return
	}

	tz, err := h.service.GetTimeZone(c.Request.Context(), lat, lng, timestamp)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Time zone error: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, tz)
}
