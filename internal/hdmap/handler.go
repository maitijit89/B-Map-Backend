package hdmap

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

// IngestObservation handles POST /api/v1/hdmap/observations
func (h *Handler) IngestObservation(c *gin.Context) {
	var obs VehiclePerceptionObservation
	if err := c.ShouldBindJSON(&obs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	proposal, err := h.service.IngestObservation(c.Request.Context(), &obs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"success":  true,
		"proposal": proposal,
	})
}

// GetActiveChanges handles GET /api/v1/hdmap/changes/nearby?lat=...&lng=...&radius=...
func (h *Handler) GetActiveChanges(c *gin.Context) {
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

	changes, err := h.service.GetActiveMapChanges(c.Request.Context(), lat, lng, radius)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"changes": changes,
	})
}
