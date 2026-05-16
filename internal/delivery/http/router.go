package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/maitijit89/B-Map-Backend/internal/delivery/ws"
	"github.com/maitijit89/B-Map-Backend/internal/middleware"
	// fiberSwagger "github.com/swaggo/fiber-swagger"
	// _ "github.com/maitijit89/B-Map-Backend/docs" // Import swagger docs
)

func SetupRoutes(app *fiber.App, userHandler *UserHandler, incidentHandler *IncidentHandler, placeHandler *PlaceHandler, timelineHandler *TimelineHandler, reviewHandler *ReviewHandler, listHandler *ListHandler, pinHandler *PinHandler, hub *ws.Hub) {
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "B_map API is running",
			"version": "1.0.0",
			"status":  "healthy",
		})
	})
	// app.Get("/swagger/*", fiberSwagger.WrapHandler)

	api := app.Group("/api/v1")

	// Public Auth routes
	users := api.Group("/users")
	users.Post("/google-login", userHandler.GoogleLogin)

	// Protected routes
	protected := api.Use(middleware.AuthMiddleware())
	
	protected.Get("/users/profile", userHandler.GetProfile)
	
	incidents := protected.Group("/incidents")
	incidents.Post("/", incidentHandler.Report)
	incidents.Get("/", incidentHandler.GetNearby)
	incidents.Post("/:id/upvote", incidentHandler.Upvote)

	places := protected.Group("/places")
	places.Get("/search", placeHandler.Search)
	places.Get("/favorites", placeHandler.GetFavorites)
	places.Get("/:id", placeHandler.GetDetails)
	places.Post("/:id/favorite", placeHandler.FavoritePlace)

	timeline := protected.Group("/timeline")
	timeline.Post("/", timelineHandler.RecordLocation)
	timeline.Get("/", timelineHandler.GetHistory)

	reviews := protected.Group("/reviews")
	reviews.Post("", reviewHandler.PostReview)
	reviews.Get("", reviewHandler.GetPlaceReviews)
	reviews.Get("/me", reviewHandler.GetMyReviews)

	lists := protected.Group("/lists")
	lists.Post("/", listHandler.CreateList)
	lists.Get("/", listHandler.GetMyLists)
	lists.Post("/:id/places", listHandler.AddPlace)

	// Navigation routes
	navigation := protected.Group("/navigation")
	navigation.Get("/directions", placeHandler.GetDirections)

	// Pin routes
	pins := protected.Group("/pins")
	pins.Get("/", pinHandler.GetMyPins)
	pins.Post("/", pinHandler.Create)
	pins.Delete("/:id", pinHandler.Delete)

	// WebSocket route (Disabled on Vercel)
	if os.Getenv("VERCEL") != "1" {
		app.Get("/ws", ws.NewHandler(hub))
	}
}
