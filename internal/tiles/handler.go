package tiles

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	tileService TileService
}

func NewHandler(tileService TileService) *Handler {
	return &Handler{tileService: tileService}
}

// ServeTile handles GET /api/v1/tiles/:z/:x/:y (supporting .mvt and .pbf extensions)
func (h *Handler) ServeTile(c *gin.Context) {
	zStr := c.Param("z")
	xStr := c.Param("x")
	yWithExt := c.Param("y")

	// Strip .mvt, .pbf, or .vector extension
	yStr := yWithExt
	for _, ext := range []string{".mvt", ".pbf", ".vector"} {
		if strings.HasSuffix(yStr, ext) {
			yStr = strings.TrimSuffix(yStr, ext)
			break
		}
	}

	z, err1 := strconv.Atoi(zStr)
	x, err2 := strconv.Atoi(xStr)
	y, err3 := strconv.Atoi(yStr)

	if err1 != nil || err2 != nil || err3 != nil || z < 0 || z > 22 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tile coordinates (z, x, y)"})
		return
	}

	tileBytes, err := h.tileService.GetVectorTile(c.Request.Context(), z, x, y)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate vector tile: " + err.Error()})
		return
	}

	if len(tileBytes) == 0 {
		c.Status(http.StatusNoContent)
		return
	}

	c.Header("Content-Type", "application/vnd.mapbox-vector-tile")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Cache-Control", "public, max-age=3600")

	c.Data(http.StatusOK, "application/vnd.mapbox-vector-tile", tileBytes)
}
