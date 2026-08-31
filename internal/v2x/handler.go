package v2x

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// GetSignalSPaT handles GET /api/v1/v2x/spat/:id
func (h *Handler) GetSignalSPaT(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "intersection ID is required"})
		return
	}

	spat, err := h.service.GetIntersectionSPaT(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, spat)
}

// GetNearbySignals handles GET /api/v1/v2x/signals/nearby?lat=...&lng=...&radius=...
func (h *Handler) GetNearbySignals(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	radiusStr := c.DefaultQuery("radius", "500")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	radius, _ := strconv.ParseFloat(radiusStr, 64)

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both 'lat' and 'lng' query parameters are required"})
		return
	}

	signals, err := h.service.GetNearbySignals(c.Request.Context(), lat, lng, radius)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"signals": signals,
	})
}

// GetGLOSAAdvisory handles POST /api/v1/v2x/glosa/advisory
func (h *Handler) GetGLOSAAdvisory(c *gin.Context) {
	var req struct {
		VehicleLocation utils.Coordinate `json:"vehicle_location" binding:"required"`
		SpeedKmh        float64          `json:"speed_kmh"`
		IntersectionID  string           `json:"intersection_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	advisory, err := h.service.CalculateGLOSA(c.Request.Context(), req.VehicleLocation, req.SpeedKmh, req.IntersectionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"advisory": advisory,
	})
}
