package boundaries

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

// GetTerritorialBorders handles GET /api/v1/boundaries/territorial?locale=...&level=...
func (h *Handler) GetTerritorialBorders(c *gin.Context) {
	locale := c.DefaultQuery("locale", "GLOBAL")
	levelStr := c.DefaultQuery("level", "-1")
	level, _ := strconv.Atoi(levelStr)

	borders, err := h.service.GetTerritorialBorders(c.Request.Context(), locale, level)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch territorial borders: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, borders)
}

// GetRegionHighlight handles GET /api/v1/boundaries/highlight?q=...&locale=...
func (h *Handler) GetRegionHighlight(c *gin.Context) {
	q := c.Query("q")
	locale := c.DefaultQuery("locale", "GLOBAL")

	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'q' (search region name) is required"})
		return
	}

	highlight, err := h.service.GetRegionHighlight(c.Request.Context(), q, locale)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate region highlight: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"highlight": highlight,
	})
}
