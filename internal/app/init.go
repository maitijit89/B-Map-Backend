package app

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"github.com/maitijit89/B-Map-Backend/internal/delivery/http"
	"github.com/maitijit89/B-Map-Backend/internal/delivery/ws"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
	"github.com/maitijit89/B-Map-Backend/internal/repository"
	"github.com/maitijit89/B-Map-Backend/internal/usecase"
	"github.com/maitijit89/B-Map-Backend/pkg/database"
	"github.com/maitijit89/B-Map-Backend/pkg/logger"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func CreateApp() *fiber.App {
	// Load environment variables only in local development
	if os.Getenv("VERCEL") != "1" {
		if err := godotenv.Load(); err != nil {
			log.Println("Note: No .env file found, using system environment variables")
		}
	} else {
		log.Println("Running on Vercel, skipping .env load")
	}

	// Initialize Logger
	logger.InitLogger()

	// Initialize Database and Cache
	db := database.InitDB()
	rdb := database.InitRedis()

	if db != nil {
		// Auto-migrate models (Skip or handle error gracefully in production/Vercel)
		if os.Getenv("ENV") != "production" && os.Getenv("VERCEL") != "1" {
			log.Println("Running auto-migration...")
			err := db.AutoMigrate(&domain.User{}, &domain.Incident{}, &domain.Place{}, &domain.UserFavorite{}, &domain.TravelHistory{}, &domain.Review{}, &domain.UserList{}, &domain.Pin{})
			if err != nil {
				log.Printf("Warning: Failed to auto-migrate: %v", err)
			}
		}
	} else {
		log.Println("Warning: Running without database connection. Some features will fail.")
	}

	// Initialize WebSocket Hub
	hub := ws.NewHub()
	// Goroutines in Vercel do not survive and can cause invocation issues
	if os.Getenv("VERCEL") != "1" {
		go hub.Run()
	}

	// Initialize Repositories
	userRepo := repository.NewUserRepository(db)
	incidentRepo := repository.NewIncidentRepository(db)
	placeRepo := repository.NewPlaceRepository(db)
	timelineRepo := repository.NewTimelineRepository(db)
	reviewRepo := repository.NewReviewRepository(db)
	listRepo := repository.NewListRepository(db)
	pinRepo := repository.NewPinRepository(db)

	// Initialize Usecases
	userUsecase := usecase.NewUserUsecase(userRepo)
	incidentUsecase := usecase.NewIncidentUsecase(incidentRepo, hub)
	placeUsecase := usecase.NewPlaceUsecase(placeRepo, rdb)
	timelineUsecase := usecase.NewTimelineUsecase(timelineRepo)
	reviewUsecase := usecase.NewReviewUsecase(reviewRepo)
	listUsecase := usecase.NewListUsecase(listRepo)
	pinUsecase := usecase.NewPinUsecase(pinRepo)

	// Initialize Handlers
	userHandler := http.NewUserHandler(userUsecase)
	incidentHandler := http.NewIncidentHandler(incidentUsecase)
	placeHandler := http.NewPlaceHandler(placeUsecase)
	timelineHandler := http.NewTimelineHandler(timelineUsecase)
	reviewHandler := http.NewReviewHandler(reviewUsecase)
	listHandler := http.NewListHandler(listUsecase)
	pinHandler := http.NewPinHandler(pinUsecase)

	// Initialize Fiber App
	app := fiber.New(fiber.Config{
		AppName: "B_map API",
	})

	// Add CORS middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// Setup Routes
	http.SetupRoutes(app, userHandler, incidentHandler, placeHandler, timelineHandler, reviewHandler, listHandler, pinHandler, hub)

	return app
}
