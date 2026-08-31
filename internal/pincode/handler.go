package pincode

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

// LookupPINCode handles GET /api/v1/pincode/:pincode
func (h *Handler) LookupPINCode(c *gin.Context) {
	code := c.Param("pincode")

	info, err := h.service.LookupPINCode(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    info,
	})
}

// ParseAddress handles POST /api/v1/pincode/parse-address
func (h *Handler) ParseAddress(c *gin.Context) {
	var body struct {
		Address string `json:"address" binding:"required"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Address string is required",
		})
		return
	}

	res, err := h.service.ParseIndianAddress(c.Request.Context(), body.Address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    res,
	})
}

// ReverseLookup handles GET /api/v1/pincode/reverse
func (h *Handler) ReverseLookup(c *gin.Context) {
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

	info, err := h.service.ReverseLookup(c.Request.Context(), lat, lng)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    info,
	})
}
