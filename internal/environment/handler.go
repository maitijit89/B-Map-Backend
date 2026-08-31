package environment

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

// GetAirQuality handles POST/GET /api/v1/environment/air-quality?lat=...&lng=...
func (h *Handler) GetAirQuality(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both 'lat' and 'lng' query parameters are required"})
		return
	}

	aqi, err := h.service.GetAirQuality(c.Request.Context(), lat, lng)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get air quality: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, aqi)
}

// GetSolar handles GET /api/v1/environment/solar?lat=...&lng=...
func (h *Handler) GetSolar(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both 'lat' and 'lng' query parameters are required"})
		return
	}

	solar, err := h.service.GetSolarPotential(c.Request.Context(), lat, lng)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate solar potential: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, solar)
}

// GetPollen handles GET /api/v1/environment/pollen?lat=...&lng=...
func (h *Handler) GetPollen(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both 'lat' and 'lng' query parameters are required"})
		return
	}

	pollen, err := h.service.GetPollen(c.Request.Context(), lat, lng)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch pollen index: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, pollen)
}
