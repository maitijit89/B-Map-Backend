package app

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"github.com/maitijit89/B-Map-Backend/internal/delivery/http"
	"github.com/maitijit89/B-Map-Backend/internal/delivery/ws"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
	"github.com/maitijit89/B-Map-Backend/internal/repository"
	"github.com/maitijit89/B-Map-Backend/internal/usecase"
	"github.com/maitijit89/B-Map-Backend/pkg/database"
	"github.com/maitijit89/B-Map-Backend/pkg/logger"
)

func CreateApp() *fiber.App {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize Logger
	logger.InitLogger()

	// Initialize Database and Cache
	db := database.InitDB()
	rdb := database.InitRedis()

	if db != nil {
		// Auto-migrate models (Skip or handle error gracefully in production/Vercel)
		if os.Getenv("ENV") != "production" {
			log.Println("Running auto-migration...")
			err := db.AutoMigrate(&domain.User{}, &domain.Incident{}, &domain.Place{}, &domain.UserFavorite{}, &domain.TravelHistory{})
			if err != nil {
				log.Printf("Warning: Failed to auto-migrate: %v", err)
			}
		}
	} else {
		log.Println("Warning: Running without database connection. Some features will fail.")
	}

	// Initialize WebSocket Hub
	hub := ws.NewHub()
	// Goroutines in Vercel might not survive, but we start it anyway for compatibility
	go hub.Run()

	// Initialize Repositories
	userRepo := repository.NewUserRepository(db)
	incidentRepo := repository.NewIncidentRepository(db)
	placeRepo := repository.NewPlaceRepository(db)
	timelineRepo := repository.NewTimelineRepository(db)

	// Initialize Usecases
	userUsecase := usecase.NewUserUsecase(userRepo)
	incidentUsecase := usecase.NewIncidentUsecase(incidentRepo, hub)
	placeUsecase := usecase.NewPlaceUsecase(placeRepo, rdb)
	timelineUsecase := usecase.NewTimelineUsecase(timelineRepo)

	// Initialize Handlers
	userHandler := http.NewUserHandler(userUsecase)
	incidentHandler := http.NewIncidentHandler(incidentUsecase)
	placeHandler := http.NewPlaceHandler(placeUsecase)
	timelineHandler := http.NewTimelineHandler(timelineUsecase)

	// Initialize Fiber App
	app := fiber.New(fiber.Config{
		AppName: "B_map API",
	})

	// Setup Routes
	http.SetupRoutes(app, userHandler, incidentHandler, placeHandler, timelineHandler, hub)

	return app
}
