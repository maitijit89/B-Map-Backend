package offline

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// CreateBundle handles POST /api/v1/offline/bundles
func (h *Handler) CreateBundle(c *gin.Context) {
	var req OfflineBundleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	manifest, err := h.service.CreateBundle(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success":  true,
		"manifest": manifest,
	})
}

// GetBundleManifest handles GET /api/v1/offline/bundles/:id
func (h *Handler) GetBundleManifest(c *gin.Context) {
	id := c.Param("id")
	manifest, err := h.service.GetBundleManifest(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, manifest)
}

// DownloadBundle handles GET /api/v1/offline/bundles/:id/download
func (h *Handler) DownloadBundle(c *gin.Context) {
	id := c.Param("id")
	data, manifest, err := h.service.GetBundleBinary(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"bmap_offline_%s.tar.gz\"", manifest.Name))
	c.Header("Content-Type", "application/gzip")
	c.Header("X-SHA256-Checksum", manifest.SHA256Hash)
	c.Data(http.StatusOK, "application/gzip", data)
}
