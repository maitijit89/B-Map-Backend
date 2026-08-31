package http

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type AuthHandler struct {
	authService domain.AuthService
	userRepo    domain.UserRepository
}

func NewAuthHandler(authService domain.AuthService, userRepo domain.UserRepository) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		userRepo:    userRepo,
	}
}

// Register handles user registration and triggers OTP generation.
// @Summary Register a new user
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body domain.RegisterRequest true "User Registration Details"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 409 {object} APIResponse
// @Router /api/v1/auth/register [post]
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req domain.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return ErrorResponse(c, fiber.StatusBadRequest, "Invalid request payload format", err.Error())
	}

	if valErrors := utils.ValidateStruct(&req); len(valErrors) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Validation failed",
			"errors":  valErrors,
		})
	}

	if err := h.authService.Register(c.Context(), &req); err != nil {
		if errors.Is(err, domain.ErrUserAlreadyExists) {
			return ErrorResponse(c, fiber.StatusConflict, err.Error(), nil)
		}
		return ErrorResponse(c, fiber.StatusInternalServerError, "Failed to process registration request", err.Error())
	}

	return SuccessResponse(c, fiber.StatusOK, "OTP sent successfully to email for registration verification", fiber.Map{
		"email": req.Email,
	})
}

// Login handles sending OTP for registered users.
// @Summary Request login OTP
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body domain.LoginRequest true "User Login Email"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Router /api/v1/auth/login [post]
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req domain.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return ErrorResponse(c, fiber.StatusBadRequest, "Invalid request payload format", err.Error())
	}

	if valErrors := utils.ValidateStruct(&req); len(valErrors) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Validation failed",
			"errors":  valErrors,
		})
	}

	if err := h.authService.Login(c.Context(), &req); err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			return ErrorResponse(c, fiber.StatusNotFound, "No account found with this email address", nil)
		}
		return ErrorResponse(c, fiber.StatusInternalServerError, "Failed to send login OTP", err.Error())
	}

	return SuccessResponse(c, fiber.StatusOK, "Login OTP sent successfully to email", fiber.Map{
		"email": req.Email,
	})
}

// VerifyOTP verifies the 6-digit OTP and generates JWT session.
// @Summary Verify OTP for Login / Registration
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body domain.VerifyOTPRequest true "OTP Verification Details"
// @Success 200 {object} APIResponse{data=domain.AuthResponse}
// @Failure 400 {object} APIResponse
// @Failure 401 {object} APIResponse
// @Router /api/v1/auth/verify-otp [post]
func (h *AuthHandler) VerifyOTP(c *fiber.Ctx) error {
	var req domain.VerifyOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return ErrorResponse(c, fiber.StatusBadRequest, "Invalid request payload format", err.Error())
	}

	if valErrors := utils.ValidateStruct(&req); len(valErrors) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"message": "Validation failed",
			"errors":  valErrors,
		})
	}

	authResp, err := h.authService.VerifyOTP(c.Context(), &req)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidOTP) || errors.Is(err, domain.ErrOTPNotFound) {
			return ErrorResponse(c, fiber.StatusUnauthorized, "Invalid or expired OTP", nil)
		}
		if errors.Is(err, domain.ErrUserNotFound) {
			return ErrorResponse(c, fiber.StatusNotFound, "User not found", nil)
		}
		return ErrorResponse(c, fiber.StatusInternalServerError, "Failed to verify OTP", err.Error())
	}

	return SuccessResponse(c, fiber.StatusOK, "Authentication successful", authResp)
}

// GetMe retrieves the authenticated user's profile.
// @Summary Get current user profile
// @Tags Auth
// @Security BearerAuth
// @Produce json
// @Success 200 {object} APIResponse{data=domain.UserResponse}
// @Failure 401 {object} APIResponse
// @Router /api/v1/auth/me [get]
func (h *AuthHandler) GetMe(c *fiber.Ctx) error {
	rawUserID := c.Locals("user_id")
	userID, ok := rawUserID.(uuid.UUID)
	if !ok {
		return ErrorResponse(c, fiber.StatusUnauthorized, "Unauthorized session", nil)
	}

	user, err := h.userRepo.GetByID(c.Context(), userID)
	if err != nil {
		return ErrorResponse(c, fiber.StatusNotFound, "User profile not found", nil)
	}

	return SuccessResponse(c, fiber.StatusOK, "User profile retrieved", user.ToResponse())
}
