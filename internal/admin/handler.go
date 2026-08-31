package admin

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/analytics"
	"github.com/maitijit89/b-map-backend/internal/rating"
	"github.com/maitijit89/b-map-backend/internal/traffic"
	"github.com/maitijit89/b-map-backend/internal/weather"
)

type Handler struct {
	adminSvc     Service
	analyticsSvc analytics.Service
	weatherSvc   weather.Service
	trafficSvc   traffic.Service
	ratingSvc    rating.Service
}

func NewHandler(
	adminSvc Service,
	analyticsSvc analytics.Service,
	weatherSvc weather.Service,
	trafficSvc traffic.Service,
	ratingSvc rating.Service,
) *Handler {
	return &Handler{
		adminSvc:     adminSvc,
		analyticsSvc: analyticsSvc,
		weatherSvc:   weatherSvc,
		trafficSvc:   trafficSvc,
		ratingSvc:    ratingSvc,
	}
}

// GetOverview handles GET /api/v1/admin/overview
func (h *Handler) GetOverview(c *gin.Context) {
	metrics, err := h.adminSvc.GetOverviewMetrics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": metrics})
}

// ListUsers handles GET /api/v1/admin/users
func (h *Handler) ListUsers(c *gin.Context) {
	search := c.Query("search")
	status := c.Query("status")
	role := c.Query("role")
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.ParseInt(limitStr, 10, 64)
	offset, _ := strconv.ParseInt(offsetStr, 10, 64)

	users, total, err := h.adminSvc.ListUsers(c.Request.Context(), search, status, role, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"users":   users,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

// GetActiveUsers handles GET /api/v1/admin/users/active
func (h *Handler) GetActiveUsers(c *gin.Context) {
	activeUsers, err := h.adminSvc.GetActiveUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"active_count": len(activeUsers),
		"users":        activeUsers,
	})
}

// GetUserByID handles GET /api/v1/admin/users/:id
func (h *Handler) GetUserByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid user ID"})
		return
	}

	user, err := h.adminSvc.GetUserByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": user})
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"` // "active" or "suspended"
}

// UpdateUserStatus handles PATCH /api/v1/admin/users/:id/status
func (h *Handler) UpdateUserStatus(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid user ID"})
		return
	}

	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Status must be 'active' or 'suspended'"})
		return
	}

	if req.Status != "active" && req.Status != "suspended" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Status must be 'active' or 'suspended'"})
		return
	}

	if err := h.adminSvc.UpdateUserStatus(c.Request.Context(), id, req.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User status updated to " + req.Status,
	})
}

// DeleteUser handles DELETE /api/v1/admin/users/:id
func (h *Handler) DeleteUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid user ID"})
		return
	}

	if err := h.adminSvc.DeleteUser(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User deleted successfully",
	})
}

// SetWeatherOverride handles POST /api/v1/admin/weather/override
func (h *Handler) SetWeatherOverride(c *gin.Context) {
	var req weather.ManualWeatherOverride
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Valid highway_name is required"})
		return
	}

	adminEmail := c.GetString("email")
	req.UpdatedBy = adminEmail

	h.weatherSvc.SetManualOverride(req)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Weather override active for " + req.HighwayName,
		"data":    req,
	})
}

// GetWeatherOverrides handles GET /api/v1/admin/weather/overrides
func (h *Handler) GetWeatherOverrides(c *gin.Context) {
	list := h.weatherSvc.GetActiveOverrides()
	c.JSON(http.StatusOK, gin.H{"success": true, "overrides": list})
}

// DeleteWeatherOverride handles DELETE /api/v1/admin/weather/override/:name
func (h *Handler) DeleteWeatherOverride(c *gin.Context) {
	name := c.Param("name")
	deleted := h.weatherSvc.DeleteOverride(name)
	c.JSON(http.StatusOK, gin.H{
		"success": deleted,
		"message": "Weather override cleared for " + name,
	})
}

// SetTrafficOverride handles POST /api/v1/admin/traffic/override
func (h *Handler) SetTrafficOverride(c *gin.Context) {
	var req traffic.ManualTrafficOverride
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Valid segment_id and congestion_level are required"})
		return
	}

	adminEmail := c.GetString("email")
	req.UpdatedBy = adminEmail

	h.trafficSvc.SetManualOverride(req)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Traffic override active for segment " + req.SegmentID,
		"data":    req,
	})
}

// GetTrafficOverrides handles GET /api/v1/admin/traffic/overrides
func (h *Handler) GetTrafficOverrides(c *gin.Context) {
	list := h.trafficSvc.GetActiveOverrides()
	c.JSON(http.StatusOK, gin.H{"success": true, "overrides": list})
}

// DeleteTrafficOverride handles DELETE /api/v1/admin/traffic/override/:id
func (h *Handler) DeleteTrafficOverride(c *gin.Context) {
	id := c.Param("id")
	deleted := h.trafficSvc.DeleteOverride(id)
	c.JSON(http.StatusOK, gin.H{
		"success": deleted,
		"message": "Traffic override cleared for " + id,
	})
}

// GetUserAnalyticsGraph handles GET /api/v1/admin/analytics/users
func (h *Handler) GetUserAnalyticsGraph(c *gin.Context) {
	daysStr := c.DefaultQuery("days", "7")
	days, _ := strconv.Atoi(daysStr)

	points, err := h.analyticsSvc.GetUserActivityGraph(c.Request.Context(), days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"days":    days,
		"points":  points,
	})
}

// GetFeatureUsageGraph handles GET /api/v1/admin/analytics/feature-usage
func (h *Handler) GetFeatureUsageGraph(c *gin.Context) {
	items, total, err := h.analyticsSvc.GetFeatureUsageGraph(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"total":    total,
		"features": items,
	})
}
