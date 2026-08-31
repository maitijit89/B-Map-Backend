package emergency

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

// TriggerSOS handles POST /api/v1/emergency/sos
func (h *Handler) TriggerSOS(c *gin.Context) {
	var req SOSAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Valid emergency type and current_location are required",
		})
		return
	}

	resp, err := h.service.TriggerSOS(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Emergency SOS dispatched to nearest Highway Patrol (1033) and Emergency Response Center (112)",
		"data":    resp,
	})
}

// GetNearbyFacilities handles GET /api/v1/emergency/facilities
func (h *Handler) GetNearbyFacilities(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Valid lat and lng query parameters are required",
		})
		return
	}

	facilities, err := h.service.GetNearbyEmergencyFacilities(c.Request.Context(), lat, lng)
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
			"count":      len(facilities),
			"facilities": facilities,
		},
	})
}
