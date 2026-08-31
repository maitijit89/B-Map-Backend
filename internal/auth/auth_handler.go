package auth

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"gorm.io/gorm"
)

// AuthHandler holds the dependencies for our HTTP routes
type AuthHandler struct {
	otpService *OTPService
	jwtService *JWTService
	db         *gorm.DB
}

// NewAuthHandler initializes the handlers with the OTP service, JWT service, and PostgreSQL GORM DB
func NewAuthHandler(otpService *OTPService, jwtService *JWTService, db *gorm.DB) *AuthHandler {
	return &AuthHandler{
		otpService: otpService,
		jwtService: jwtService,
		db:         db,
	}
}

// LoginRequest defines the expected JSON payload for requesting an OTP
type LoginRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// RequestOTP handles POST /api/v1/auth/login
func (h *AuthHandler) RequestOTP(c *gin.Context) {
	var req LoginRequest

	// Automatically validate email format
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email format or missing field"})
		return
	}

	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// Generate and store OTP in Redis with 5m TTL
	otp, err := h.otpService.GenerateAndStoreOTP(c.Request.Context(), normalizedEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate OTP. Please try again later."})
		return
	}

	// Mock Email Notification
	fmt.Printf("[Mock Email Service] B Map login code for %s is: %s\n", normalizedEmail, otp)

	c.JSON(http.StatusOK, gin.H{
		"message": "OTP successfully sent to your email",
	})
}

// VerifyRequest defines the expected JSON payload for verifying an OTP
type VerifyRequest struct {
	Email string `json:"email" binding:"required,email"`
	OTP   string `json:"otp" binding:"required,len=6"`
	Name  string `json:"name"` // Optional: provided during registration
	Age   int    `json:"age"`  // Optional: provided during registration
}

// VerifyOTP handles POST /api/v1/auth/verify
func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var req VerifyRequest

	// Validate JSON body
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request. Ensure email and 6-digit OTP are provided."})
		return
	}

	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// 1. Verify OTP with Redis (and atomic deletion on success)
	isValid, err := h.otpService.VerifyOTP(c.Request.Context(), normalizedEmail, req.OTP)
	if err != nil || !isValid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired OTP"})
		return
	}

	// 2. Query PostgreSQL to see if user exists
	var user domain.User
	result := h.db.WithContext(c.Request.Context()).Where("LOWER(email) = LOWER(?)", normalizedEmail).First(&user)

	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		// New User: Auto-register in PostgreSQL
		displayName := req.Name
		if displayName == "" {
			displayName = strings.Split(normalizedEmail, "@")[0] // Default name from email prefix
		}

		user = domain.User{
			Name:  displayName,
			Age:   req.Age,
			Email: normalizedEmail,
		}

		if err := h.db.WithContext(c.Request.Context()).Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user profile in database"})
			return
		}
	} else if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error while querying user"})
		return
	}

	// 3. Generate Signed JWT containing the real PostgreSQL User ID
	token, err := h.jwtService.GenerateToken(user.Email, user.ID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication token"})
		return
	}

	// 4. Return success response with JWT and user data
	c.JSON(http.StatusOK, gin.H{
		"message": "Authentication successful",
		"token":   token,
		"user":    user.ToResponse(),
	})
}

// GetProfile handles GET /api/v1/auth/me (Protected by AuthMiddleware)
func (h *AuthHandler) GetProfile(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized session"})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format in token claims"})
		return
	}

	var user domain.User
	if err := h.db.WithContext(c.Request.Context()).First(&user, "id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "User profile not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error fetching profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User profile retrieved successfully",
		"user":    user.ToResponse(),
	})
}
