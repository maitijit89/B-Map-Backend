package routes

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type Handler struct {
	engine Engine
}

func NewHandler(engine Engine) *Handler {
	return &Handler{engine: engine}
}

// GetDirections handles GET /api/v1/routes/directions
func (h *Handler) GetDirections(c *gin.Context) {
	originStr := c.Query("origin")
	destStr := c.Query("destination")
	modeStr := c.DefaultQuery("mode", "driving")

	if originStr == "" || destStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Both 'origin' (lat,lng) and 'destination' (lat,lng) query parameters are required",
		})
		return
	}

	origin, err := parseCoordinate(originStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid origin coordinate format: " + err.Error()})
		return
	}

	destination, err := parseCoordinate(destStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid destination coordinate format: " + err.Error()})
		return
	}

	var waypoints []utils.Coordinate
	if wpParam := c.Query("waypoints"); wpParam != "" {
		for _, wpStr := range strings.Split(wpParam, "|") {
			if wp, err := parseCoordinate(wpStr); err == nil {
				waypoints = append(waypoints, wp)
			}
		}
	}

	req := &RouteRequest{
		Origin:      origin,
		Destination: destination,
		Mode:        TravelMode(modeStr),
		Waypoints:   waypoints,
	}

	route, err := h.engine.CalculateRoute(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate route: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"route":   route,
	})
}

// TrackProgress handles POST /api/v1/routes/progress (Evaluates live GPS fix, remaining ETA, and auto-rerouting)
func (h *Handler) TrackProgress(c *gin.Context) {
	var req struct {
		UserLocation utils.Coordinate `json:"user_location" binding:"required"`
		Route        RouteResponse    `json:"route" binding:"required"`
		Mode         TravelMode       `json:"mode"`
		ThresholdM   float64          `json:"off_route_threshold_meters"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload: " + err.Error()})
		return
	}

	mode := req.Mode
	if mode == "" {
		mode = TravelModeDriving
	}

	progress, newRoute, err := EvaluateProgress(
		c.Request.Context(),
		h.engine,
		req.UserLocation,
		&req.Route,
		req.ThresholdM,
		mode,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate navigation progress: " + err.Error()})
		return
	}

	resp := gin.H{
		"success":  true,
		"progress": progress,
	}

	if newRoute != nil {
		resp["rerouted"] = true
		resp["new_route"] = newRoute
	} else {
		resp["rerouted"] = false
	}

	c.JSON(http.StatusOK, resp)
}

func parseCoordinate(s string) (utils.Coordinate, error) {
	parts := strings.Split(strings.TrimSpace(s), ",")
	if len(parts) != 2 {
		return utils.Coordinate{}, fmt.Errorf("expected format 'latitude,longitude', got '%s'", s)
	}

	lat, err1 := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
	lng, err2 := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
	if err1 != nil || err2 != nil {
		return utils.Coordinate{}, fmt.Errorf("invalid numerical values")
	}

	if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return utils.Coordinate{}, fmt.Errorf("coordinates out of range")
	}

	return utils.Coordinate{Latitude: lat, Longitude: lng}, nil
}
