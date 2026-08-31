package navic

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// ProcessFix handles POST /api/v1/navic/fix
func (h *Handler) ProcessFix(c *gin.Context) {
	var req NavICFixRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid NavIC fix payload. Latitude and Longitude are required.",
		})
		return
	}

	result, err := h.service.ProcessNavICFix(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

// GetConstellation handles GET /api/v1/navic/constellation
func (h *Handler) GetConstellation(c *gin.Context) {
	sats, err := h.service.GetConstellationStatus(c.Request.Context())
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
			"satellites":        sats,
			"active_count":      len(sats),
			"constellation_type": "NavIC (IRNSS) + GAGAN SBAS",
		},
	})
}
