package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
)

type UserHandler struct {
	usecase domain.UserUsecase
}

func NewUserHandler(usecase domain.UserUsecase) *UserHandler {
	return &UserHandler{usecase: usecase}
}

// Register godoc
// @Summary Register a new user
// @Tags users
// @Accept json
// @Produce json
// @Param request body domain.UserRegistration true "User details"
// @Success 201 {object} domain.AuthResponse
// @Router /users/register [post]
func (h *UserHandler) Register(c *fiber.Ctx) error {
	var req domain.UserRegistration
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	res, err := h.usecase.Register(c.Context(), &req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(res)
}

// Login godoc
// @Summary Login user
// @Tags users
// @Accept json
// @Produce json
// @Param request body domain.UserLogin true "Credentials"
// @Success 200 {object} domain.AuthResponse
// @Router /users/login [post]
func (h *UserHandler) Login(c *fiber.Ctx) error {
	var req domain.UserLogin
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	res, err := h.usecase.Login(c.Context(), &req)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(res)
}

// GoogleLogin godoc
// @Summary Login with Google
// @Tags users
// @Accept json
// @Produce json
// @Param request body domain.GoogleLogin true "Google ID Token"
// @Success 200 {object} domain.AuthResponse
// @Router /users/google-login [post]
func (h *UserHandler) GoogleLogin(c *fiber.Ctx) error {
	var req domain.GoogleLogin
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	res, err := h.usecase.GoogleLogin(c.Context(), &req)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(res)
}

// GetProfile godoc
// @Summary Get user profile
// @Tags users
// @Security ApiKeyAuth
// @Produce json
// @Success 200 {object} domain.User
// @Router /users/profile [get]
func (h *UserHandler) GetProfile(c *fiber.Ctx) error {
	userIDStr := c.Locals("user_id").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid user id"})
	}

	user, err := h.usecase.GetProfile(c.Context(), userID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	return c.JSON(user)
}
