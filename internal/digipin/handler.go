package digipin

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

// EncodeCoordinates handles GET /api/v1/digipin/encode
func (h *Handler) EncodeCoordinates(c *gin.Context) {
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

	result, err := h.service.EncodeCoordinates(c.Request.Context(), lat, lng)
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

// DecodeCode handles GET /api/v1/digipin/decode/:code
func (h *Handler) DecodeCode(c *gin.Context) {
	code := c.Param("code")
	result, err := h.service.DecodeDIGIPIN(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
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
