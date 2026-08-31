package lanelevel

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

// CorrectRTK handles POST /api/v1/lanelevel/rtk/correct
func (h *Handler) CorrectRTK(c *gin.Context) {
	var fix GNSSRawFix
	if err := c.ShouldBindJSON(&fix); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.ApplyRTKCorrection(c.Request.Context(), &fix)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetLaneGuidance handles GET /api/v1/lanelevel/guidance?lat=...&lng=...&maneuver=turn_left&dist=250
func (h *Handler) GetLaneGuidance(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	maneuver := c.DefaultQuery("maneuver", "continue")
	distStr := c.DefaultQuery("dist", "200")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	dist, _ := strconv.ParseFloat(distStr, 64)

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both 'lat' and 'lng' query parameters are required"})
		return
	}

	guidance, err := h.service.GetLaneGuidance(c.Request.Context(), utils.Coordinate{Latitude: lat, Longitude: lng}, maneuver, dist)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, guidance)
}
