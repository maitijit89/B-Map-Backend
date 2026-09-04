package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maitijit89/b-map-backend/config"
	httpHandler "github.com/maitijit89/b-map-backend/internal/handler/http"
	"github.com/maitijit89/b-map-backend/internal/middleware"
)

type RouterConfig struct {
	App           *fiber.App
	Config        *config.Config
	AuthHandler   *httpHandler.AuthHandler
	PlaceHandler  *httpHandler.PlaceHandler
	UploadHandler *httpHandler.UploadHandler
}

// RegisterRoutes registers all API endpoints and route groups.
func RegisterRoutes(rc *RouterConfig) {
	// Health check endpoint
	rc.App.Get("/health", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"status":  "healthy",
			"app":     rc.Config.App.Name,
			"version": rc.Config.App.Version,
		})
	})

	// API v1 root group
	api := rc.App.Group("/api/v1")

	// Auth routes
	auth := api.Group("/auth")
	{
		auth.Post("/register", rc.AuthHandler.Register)
		auth.Post("/login", rc.AuthHandler.Login)
		auth.Post("/verify-otp", rc.AuthHandler.VerifyOTP)
		auth.Get("/me", middleware.Protected(rc.Config), rc.AuthHandler.GetMe)
	}

	// Places & Geospatial routes
	places := api.Group("/places")
	{
		places.Get("/nearby", rc.PlaceHandler.GetNearbyPlaces)
		places.Get("/:id", rc.PlaceHandler.GetPlaceByID)
		places.Post("/", middleware.Protected(rc.Config), rc.PlaceHandler.CreatePlace)
	}

	// Media upload routes
	upload := api.Group("/upload")
	{
		upload.Post("/", middleware.Protected(rc.Config), rc.UploadHandler.UploadImage)
	}
}
