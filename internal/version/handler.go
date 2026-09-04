package version

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/pkg/response"
)

// Handler handles HTTP requests for version and update management.
type Handler struct {
	svc Service
}

// NewHandler creates a new version Handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// GetVersion handles GET /api/v1/app/version and GET /api/v1/version
func (h *Handler) GetVersion(c *gin.Context) {
	cfg, err := h.svc.GetVersion(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to retrieve version configuration", err.Error())
		return
	}
	response.Success(c, http.StatusOK, cfg)
}

// CheckUpdate handles GET /api/v1/app/check-update
// Query params:
// - current_version (or version): client app version, e.g. "0.1.1"
// - version_code: client app version code integer, e.g. 11
// - platform: "android" | "ios"
func (h *Handler) CheckUpdate(c *gin.Context) {
	currentVer := c.Query("current_version")
	if currentVer == "" {
		currentVer = c.Query("version")
	}
	if currentVer == "" {
		currentVer = c.Query("v")
	}

	codeStr := c.Query("version_code")
	if codeStr == "" {
		codeStr = c.Query("code")
	}
	code, _ := strconv.Atoi(codeStr)

	platform := c.DefaultQuery("platform", "android")

	result, err := h.svc.CheckUpdate(c.Request.Context(), currentVer, code, platform)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to check update status", err.Error())
		return
	}

	response.Success(c, http.StatusOK, result)
}

// PatchVersion handles PATCH /api/v1/admin/version and PATCH /api/v1/app/version
func (h *Handler) PatchVersion(c *gin.Context) {
	var req PatchVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid JSON payload for version update: "+err.Error())
		return
	}

	// Extract caller identity if available
	updatedBy := "admin"
	if email, exists := c.Get("UserEmail"); exists {
		if emailStr, ok := email.(string); ok && emailStr != "" {
			updatedBy = emailStr
		}
	}

	updated, err := h.svc.PatchVersion(c.Request.Context(), &req, updatedBy)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to patch version configuration", err.Error())
		return
	}

	response.Success(c, http.StatusOK, gin.H{
		"message": "Application version configuration updated successfully",
		"config":  updated,
	})
}
