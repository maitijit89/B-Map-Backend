package traffic

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// IngestTelemetry handles POST /api/v1/traffic/telemetry
func (h *Handler) IngestTelemetry(c *gin.Context) {
	var req struct {
		Pings []TelemetryPing `json:"pings" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.IngestTelemetry(c.Request.Context(), req.Pings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"success":        true,
		"pings_ingested": len(req.Pings),
	})
}

// GetNearbyTraffic handles GET /api/v1/traffic/segments/nearby?lat=...&lng=...&radius=...
func (h *Handler) GetNearbyTraffic(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	radiusStr := c.DefaultQuery("radius", "2000")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	radius, _ := strconv.ParseFloat(radiusStr, 64)

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both 'lat' and 'lng' query parameters are required"})
		return
	}

	segments, err := h.service.GetTrafficSegments(c.Request.Context(), lat, lng, radius)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"segments": segments,
	})
}

// EvaluateLiveETA handles POST /api/v1/traffic/evaluate-eta
func (h *Handler) EvaluateLiveETA(c *gin.Context) {
	var req struct {
		RoutePolyline string `json:"route_polyline" binding:"required"`
		InitialETASec int    `json:"initial_eta_seconds" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	eval, err := h.service.EvaluateLiveETA(c.Request.Context(), req.RoutePolyline, req.InitialETASec)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, eval)
}
