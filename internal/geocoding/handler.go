package geocoding

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

// Geocode handles GET /api/v1/geocoding/geocode?address=...
func (h *Handler) Geocode(c *gin.Context) {
	address := c.Query("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'address' is required"})
		return
	}

	results, err := h.service.Geocode(c.Request.Context(), address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Geocoding error: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "OK",
		"results": results,
	})
}

// ReverseGeocode handles GET /api/v1/geocoding/reverse?lat=...&lng=...
func (h *Handler) ReverseGeocode(c *gin.Context) {
	latStr := c.Query("lat")
	lngStr := c.Query("lng")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both 'lat' and 'lng' query parameters are required"})
		return
	}

	result, err := h.service.ReverseGeocode(c.Request.Context(), lat, lng)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Reverse geocoding error: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "OK",
		"result": result,
	})
}

// ValidateAddress handles POST /api/v1/address/validate
func (h *Handler) ValidateAddress(c *gin.Context) {
	var req struct {
		Address string `json:"address" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "address field is required in JSON body"})
		return
	}

	validation, err := h.service.ValidateAddress(c.Request.Context(), req.Address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Address validation failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "OK",
		"result": validation,
	})
}
