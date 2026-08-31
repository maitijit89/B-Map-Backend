package roadhazards

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

// GetAheadHazards handles GET /api/v1/hazards/ahead
func (h *Handler) GetAheadHazards(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	lookaheadStr := c.DefaultQuery("lookahead_meters", "500")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	lookahead, _ := strconv.ParseFloat(lookaheadStr, 64)

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "lat and lng parameters are required",
		})
		return
	}

	req := &HazardQueryRequest{
		CurrentLocation: utils.Coordinate{Latitude: lat, Longitude: lng},
		LookaheadMeters: lookahead,
	}

	hazards, err := h.service.GetAheadHazards(c.Request.Context(), req)
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
			"count":   len(hazards),
			"hazards": hazards,
		},
	})
}

// ReportHazard handles POST /api/v1/hazards/report
func (h *Handler) ReportHazard(c *gin.Context) {
	var body RoadHazard
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid road hazard report payload",
		})
		return
	}

	created, err := h.service.ReportHazard(c.Request.Context(), &body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Hazard reported successfully. Thank you for contributing to Indian road safety.",
		"data":    created,
	})
}
