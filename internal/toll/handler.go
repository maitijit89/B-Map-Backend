package toll

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

// CalculateTolls handles POST /api/v1/tolls/calculate
func (h *Handler) CalculateTolls(c *gin.Context) {
	var req TollCalculationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid toll calculation request",
		})
		return
	}

	resp, err := h.service.CalculateTolls(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    resp,
	})
}

// GetNearbyPlazas handles GET /api/v1/tolls/nearby
func (h *Handler) GetNearbyPlazas(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	radiusStr := c.DefaultQuery("radius_km", "50")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	radius, _ := strconv.ParseFloat(radiusStr, 64)

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Valid lat and lng query parameters are required",
		})
		return
	}

	plazas, err := h.service.GetNearbyTollPlazas(c.Request.Context(), lat, lng, radius)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"count":  len(plazas),
			"plazas": plazas,
		},
	})
}
