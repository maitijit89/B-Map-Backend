package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

// Protected verifies the Bearer JWT token in Authorization header.
func Protected(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": "Authorization header missing",
			})
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": "Invalid Authorization header format. Expected 'Bearer <token>'",
			})
		}

		tokenString := parts[1]
		claims, err := utils.ValidateJWT(tokenString, cfg.JWT.Secret)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": "Invalid or expired token",
			})
		}

		// Store user details in fiber context locals for downstream handlers
		c.Locals("user_id", claims.UserID)
		c.Locals("email", claims.Email)

		return c.Next()
	}
}

// OptionalAuth parses the JWT if present, but does not block the request if missing.
func OptionalAuth(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
				if claims, err := utils.ValidateJWT(parts[1], cfg.JWT.Secret); err == nil {
					c.Locals("user_id", claims.UserID)
					c.Locals("email", claims.Email)
				}
			}
		}
		return c.Next()
	}
}
