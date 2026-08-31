package weather

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

// GetHighwayWeather handles GET /api/v1/weather/highway
func (h *Handler) GetHighwayWeather(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")
	highway := c.DefaultQuery("highway", "National Highway")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Valid lat and lng query parameters are required",
		})
		return
	}

	report, err := h.service.GetHighwayWeather(c.Request.Context(), lat, lng, highway)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    report,
	})
}
