package auth

import (
	"errors"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/email"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func getAdminEmail() string {
	adminEmail := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL")))
	if adminEmail == "" {
		adminEmail = "maitidebjit2@gmail.com"
	}
	return adminEmail
}

// AuthHandler holds the dependencies for all authentication HTTP routes
type AuthHandler struct {
	otpService   *OTPService
	jwtService   *JWTService
	emailService email.Service
	coll         *mongo.Collection
}

// NewAuthHandler initializes the handlers with OTP service, JWT service, Email service, and MongoDB
func NewAuthHandler(otpService *OTPService, jwtService *JWTService, emailService email.Service, db *mongo.Database) *AuthHandler {
	var coll *mongo.Collection
	if db != nil {
		coll = db.Collection("users")
	}
	return &AuthHandler{
		otpService:   otpService,
		jwtService:   jwtService,
		emailService: emailService,
		coll:         coll,
	}
}

// LoginRequest defines the expected JSON payload for requesting an OTP
type LoginRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// RequestOTP handles POST /api/v1/auth/login (or /api/v1/auth/request-otp)
func (h *AuthHandler) RequestOTP(c *gin.Context) {
	var req LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Valid email address is required",
		})
		return
	}

	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// Check if user is suspended before sending OTP
	var existingUser domain.User
	filter := bson.M{
		"email": bson.M{
			"$regex":   "^" + regexp.QuoteMeta(normalizedEmail) + "$",
			"$options": "i",
		},
	}
	err := h.coll.FindOne(c.Request.Context(), filter).Decode(&existingUser)
	if err == nil && existingUser.Status == "suspended" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "This account has been suspended by an administrator. Please contact support.",
		})
		return
	}

	// Generate and store OTP in Redis with 90-second cooldown & brute-force tracking
	otp, err := h.otpService.GenerateAndStoreOTP(c.Request.Context(), normalizedEmail)
	if err != nil {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Deliver branded OTP email via Gmail SMTP
	if h.emailService != nil {
		go func(dest, code string) {
			if err := h.emailService.SendOTPEmail(dest, code); err != nil {
				log.Printf("[Auth] Error dispatching OTP email to %s: %v", dest, err)
			}
		}(normalizedEmail, otp)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Verification code successfully sent to " + normalizedEmail,
		"meta": gin.H{
			"expires_in_minutes": 5,
			"cooldown_seconds":   90, // 1 minute 30 seconds resend cooldown
		},
	})
}

// RequestAdminOTP handles POST /api/v1/auth/admin/request-otp (or /admin/login)
func (h *AuthHandler) RequestAdminOTP(c *gin.Context) {
	var req LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Valid email address is required",
		})
		return
	}

	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))
	adminEmail := getAdminEmail()

	// Strictly enforce that admin OTP is ONLY sent to the authorized admin email (maitidebjit2@gmail.com)
	if normalizedEmail != adminEmail {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied. Admin OTP can only be requested for the designated administrator address (" + adminEmail + ")",
		})
		return
	}

	// Generate and store OTP in Redis with 90-second cooldown
	otp, err := h.otpService.GenerateAndStoreOTP(c.Request.Context(), normalizedEmail)
	if err != nil {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Deliver branded OTP email via Gmail SMTP to admin
	if h.emailService != nil {
		go func(dest, code string) {
			if err := h.emailService.SendOTPEmail(dest, code); err != nil {
				log.Printf("[Auth Admin] Error dispatching OTP email to %s: %v", dest, err)
			}
		}(normalizedEmail, otp)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Administrator verification code successfully sent to " + normalizedEmail,
		"meta": gin.H{
			"expires_in_minutes": 5,
			"cooldown_seconds":   90, // 1 minute 30 seconds resend cooldown
			"role":               "admin",
		},
	})
}

// VerifyRequest defines the JSON payload for verifying an OTP
type VerifyRequest struct {
	Email string `json:"email" binding:"required,email"`
	OTP   string `json:"otp" binding:"required,len=6"`
	Name  string `json:"name"` // Optional: provided during first-time registration
	Age   int    `json:"age"`  // Optional
}

// VerifyOTP handles POST /api/v1/auth/verify
func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var req VerifyRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Ensure email and 6-digit verification code are provided",
		})
		return
	}

	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// 1. Verify OTP with Redis (single-use + brute-force limit)
	isValid, err := h.otpService.VerifyOTP(c.Request.Context(), normalizedEmail, req.OTP)
	if err != nil || !isValid {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// 2. Query MongoDB to see if user exists or auto-register
	var user domain.User
	filter := bson.M{
		"email": bson.M{
			"$regex":   "^" + regexp.QuoteMeta(normalizedEmail) + "$",
			"$options": "i",
		},
	}

	adminEmail := getAdminEmail()

	err = h.coll.FindOne(c.Request.Context(), filter).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		displayName := strings.TrimSpace(req.Name)
		if displayName == "" {
			displayName = strings.Split(normalizedEmail, "@")[0]
		}

		// Determine role: check if configured admin email
		role := "user"
		if normalizedEmail == adminEmail {
			role = "admin"
		} else {
			// If total count is 0, make first user admin
			count, _ := h.coll.CountDocuments(c.Request.Context(), bson.M{})
			if count == 0 {
				role = "admin"
			}
		}

		user = domain.User{
			ID:                 uuid.New(),
			Name:               displayName,
			Age:                req.Age,
			Email:              normalizedEmail,
			Role:               role,
			Status:             "active",
			LastActiveAt:       time.Now().UTC(),
			TotalActiveMinutes: 1,
			ClientIP:           c.ClientIP(),
			CreatedAt:          time.Now().UTC(),
			UpdatedAt:          time.Now().UTC(),
		}

		if _, err := h.coll.InsertOne(c.Request.Context(), &user); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   "Failed to create user account in database",
			})
			return
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database query error",
		})
		return
	} else {
		// Existing user: check suspension
		if user.Status == "suspended" {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Your account has been suspended by an administrator. Please contact support.",
			})
			return
		}

		// If this is the admin email, ensure role is "admin"
		role := user.Role
		if normalizedEmail == adminEmail {
			role = "admin"
		}

		now := time.Now().UTC()
		updateDoc := bson.M{
			"$set": bson.M{
				"role":           role,
				"last_active_at": now,
				"client_ip":      c.ClientIP(),
				"updated_at":     now,
			},
			"$inc": bson.M{
				"total_active_minutes": 1,
			},
		}
		_, _ = h.coll.UpdateOne(c.Request.Context(), bson.M{"_id": user.ID}, updateDoc)
		user.Role = role
		user.LastActiveAt = now
		user.ClientIP = c.ClientIP()
	}

	// 3. Issue Access Token (JWT) & Refresh Token with role and status
	tokenPair, err := h.jwtService.GenerateTokenPair(c.Request.Context(), user.Email, user.ID.String(), user.Role, user.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate authentication tokens",
		})
		return
	}

	// 4. Return success envelope with token pair and user profile
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Authentication successful",
		"data": gin.H{
			"tokens": tokenPair,
			"user":   user.ToResponse(),
		},
	})
}

// VerifyAdminOTP handles POST /api/v1/auth/admin/verify
func (h *AuthHandler) VerifyAdminOTP(c *gin.Context) {
	var req VerifyRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Email and 6-digit verification code are required",
		})
		return
	}

	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))
	adminEmail := getAdminEmail()

	// Ensure only the authorized admin email can complete admin verification
	if normalizedEmail != adminEmail {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Access denied. Unauthorized administrator identity",
		})
		return
	}

	// 1. Verify OTP with Redis
	isValid, err := h.otpService.VerifyOTP(c.Request.Context(), normalizedEmail, req.OTP)
	if err != nil || !isValid {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// 2. Find or create admin user in MongoDB
	var user domain.User
	filter := bson.M{
		"email": bson.M{
			"$regex":   "^" + regexp.QuoteMeta(normalizedEmail) + "$",
			"$options": "i",
		},
	}

	now := time.Now().UTC()
	err = h.coll.FindOne(c.Request.Context(), filter).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		user = domain.User{
			ID:                 uuid.New(),
			Name:               "Administrator",
			Email:              normalizedEmail,
			Role:               "admin",
			Status:             "active",
			LastActiveAt:       now,
			TotalActiveMinutes: 1,
			ClientIP:           c.ClientIP(),
			CreatedAt:          now,
			UpdatedAt:          now,
		}
		_, _ = h.coll.InsertOne(c.Request.Context(), &user)
	} else if err == nil {
		updateDoc := bson.M{
			"$set": bson.M{
				"role":           "admin",
				"status":         "active",
				"last_active_at": now,
				"client_ip":      c.ClientIP(),
				"updated_at":     now,
			},
			"$inc": bson.M{
				"total_active_minutes": 1,
			},
		}
		_, _ = h.coll.UpdateOne(c.Request.Context(), bson.M{"_id": user.ID}, updateDoc)
		user.Role = "admin"
		user.Status = "active"
		user.LastActiveAt = now
	}

	// 3. Issue Access Token with role="admin"
	tokenPair, err := h.jwtService.GenerateTokenPair(c.Request.Context(), user.Email, user.ID.String(), "admin", "active")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate administrator tokens",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Administrator authentication successful",
		"data": gin.H{
			"tokens": tokenPair,
			"user":   user.ToResponse(),
		},
	})
}

// TelemetryRequest defines payload for client heartbeat and real-time location stream
type TelemetryRequest struct {
	Latitude           float64 `json:"latitude"`
	Longitude          float64 `json:"longitude"`
	Device             string  `json:"device"`
	ActiveMinutesDelta int64   `json:"active_minutes_delta"`
}

// UpdateTelemetry handles POST /api/v1/auth/telemetry (Protected by AuthMiddleware)
func (h *AuthHandler) UpdateTelemetry(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Invalid user session",
		})
		return
	}

	var req TelemetryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid telemetry payload",
		})
		return
	}

	now := time.Now().UTC()
	updateFields := bson.M{
		"last_active_at": now,
		"client_ip":      c.ClientIP(),
		"updated_at":     now,
	}
	if req.Latitude != 0 || req.Longitude != 0 {
		updateFields["current_latitude"] = req.Latitude
		updateFields["current_longitude"] = req.Longitude
	}
	if req.Device != "" {
		updateFields["device"] = req.Device
	}

	delta := req.ActiveMinutesDelta
	if delta <= 0 {
		delta = 1
	}

	updateDoc := bson.M{
		"$set": updateFields,
		"$inc": bson.M{
			"total_active_minutes": delta,
		},
	}

	_, err = h.coll.UpdateOne(c.Request.Context(), bson.M{"_id": userID}, updateDoc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update telemetry",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Telemetry updated successfully",
		"timestamp": now,
	})
}

// RefreshTokenRequest defines the JSON payload for token rotation
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// RefreshToken handles POST /api/v1/auth/refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Refresh token is required",
		})
		return
	}

	newTokenPair, err := h.jwtService.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Token refreshed successfully",
		"data": gin.H{
			"tokens": newTokenPair,
		},
	})
}

// LogoutRequest defines optional payload for explicit session revocation
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// Logout handles POST /api/v1/auth/logout (Protected by AuthMiddleware)
func (h *AuthHandler) Logout(c *gin.Context) {
	var req LogoutRequest
	_ = c.ShouldBindJSON(&req)

	var claims *CustomClaims
	if val, exists := c.Get("claims"); exists {
		claims, _ = val.(*CustomClaims)
	}

	_ = h.jwtService.RevokeSession(c.Request.Context(), req.RefreshToken, claims)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Logged out successfully",
	})
}

// GetProfile handles GET /api/v1/auth/me (Protected by AuthMiddleware)
func (h *AuthHandler) GetProfile(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Unauthorized session",
		})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid user ID format in token claims",
		})
		return
	}

	var user domain.User
	if err := h.coll.FindOne(c.Request.Context(), bson.M{"_id": userID}).Decode(&user); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "User profile not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Database error fetching profile",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"user": user.ToResponse(),
		},
	})
}

// UpdateProfileRequest defines the payload for profile modification
type UpdateProfileRequest struct {
	Name      string `json:"name"`
	Age       int    `json:"age"`
	AvatarURL string `json:"avatar_url"`
}

// UpdateProfile handles PUT /api/v1/auth/profile (Protected by AuthMiddleware)
func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Invalid session",
		})
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid profile update parameters",
		})
		return
	}

	var user domain.User
	if err := h.coll.FindOne(c.Request.Context(), bson.M{"_id": userID}).Decode(&user); err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "User not found",
		})
		return
	}

	if req.Name != "" {
		user.Name = strings.TrimSpace(req.Name)
	}
	if req.Age > 0 {
		user.Age = req.Age
	}
	if req.AvatarURL != "" {
		user.AvatarURL = strings.TrimSpace(req.AvatarURL)
	}
	user.UpdatedAt = time.Now().UTC()

	if _, err := h.coll.ReplaceOne(c.Request.Context(), bson.M{"_id": userID}, &user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to update profile",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Profile updated successfully",
		"data": gin.H{
			"user": user.ToResponse(),
		},
	})
}
