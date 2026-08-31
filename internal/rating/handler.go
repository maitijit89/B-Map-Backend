package rating

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
)

type Handler struct {
	service  Service
	userRepo domain.UserRepository
}

func NewHandler(service Service, userRepo domain.UserRepository) *Handler {
	return &Handler{
		service:  service,
		userRepo: userRepo,
	}
}

// SubmitRating handles POST /api/v1/ratings (Protected by AuthMiddleware)
func (h *Handler) SubmitRating(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Invalid user session",
		})
		return
	}

	var req SubmitRatingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Ensure a star rating between 1 and 5 is provided",
		})
		return
	}

	// Fetch user details for name & email
	userName := "App User"
	userEmail := c.GetString("email")
	if h.userRepo != nil {
		u, err := h.userRepo.GetByID(c.Request.Context(), userID)
		if err == nil && u != nil {
			userName = u.Name
			userEmail = u.Email
		}
	}

	rating, err := h.service.SubmitRating(c.Request.Context(), userID, userName, userEmail, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Thank you for your rating and feedback!",
		"data":    rating,
	})
}

// GetMyRating handles GET /api/v1/ratings/my-rating (Protected by AuthMiddleware)
func (h *Handler) GetMyRating(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Invalid user session",
		})
		return
	}

	rating, err := h.service.GetMyRating(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    rating,
	})
}

// GetAdminRatings handles GET /api/v1/admin/ratings (Protected by AdminMiddleware)
func (h *Handler) GetAdminRatings(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.ParseInt(limitStr, 10, 64)
	offset, _ := strconv.ParseInt(offsetStr, 10, 64)

	ratings, total, err := h.service.ListRatings(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	stats, _ := h.service.GetRatingStats(c.Request.Context())

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"stats":   stats,
		"ratings": ratings,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}
