package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/maitijit89/B-Map-Backend/internal/delivery/ws"
	"github.com/maitijit89/B-Map-Backend/internal/middleware"
	fiberSwagger "github.com/swaggo/fiber-swagger"
	_ "github.com/maitijit89/B-Map-Backend/docs" // Import swagger docs
)

func SetupRoutes(app *fiber.App, userHandler *UserHandler, incidentHandler *IncidentHandler, placeHandler *PlaceHandler, timelineHandler *TimelineHandler, hub *ws.Hub) {
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New())

	app.Get("/swagger/*", fiberSwagger.WrapHandler)
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})

	api := app.Group("/api/v1")

	// Public Auth routes
	users := api.Group("/users")
	users.Post("/register", userHandler.Register)
	users.Post("/login", userHandler.Login)
	users.Post("/google-login", userHandler.GoogleLogin)

	// Protected routes
	protected := api.Use(middleware.AuthMiddleware())
	
	protected.Get("/users/profile", userHandler.GetProfile)
	
	incidents := protected.Group("/incidents")
	incidents.Post("/", incidentHandler.Report)
	incidents.Get("/", incidentHandler.GetNearby)

	places := protected.Group("/places")
	places.Get("/search", placeHandler.Search)
	places.Get("/favorites", placeHandler.GetFavorites)
	places.Get("/:id", placeHandler.GetDetails)
	places.Post("/:id/favorite", placeHandler.FavoritePlace)

	timeline := protected.Group("/timeline")
	timeline.Post("/", timelineHandler.RecordLocation)
	timeline.Get("/", timelineHandler.GetHistory)

	// WebSocket route
	app.Get("/ws", ws.NewHandler(hub))
}
