package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/internal/handler"
	httpHandler "github.com/maitijit89/b-map-backend/internal/handler/http"
	"github.com/maitijit89/b-map-backend/internal/middleware"
	mongoRepo "github.com/maitijit89/b-map-backend/internal/repository/mongodb"
	redisRepo "github.com/maitijit89/b-map-backend/internal/repository/redis"
	"github.com/maitijit89/b-map-backend/internal/service"
	"github.com/maitijit89/b-map-backend/pkg/cloudinary"
	"github.com/maitijit89/b-map-backend/pkg/database"
)

func main() {
	// 1. Load configuration
	cfg := config.LoadConfig()
	log.Printf("Starting %s in %s mode on port %s", cfg.App.Name, cfg.App.Env, cfg.App.Port)

	// 2. Initialize MongoDB (with 2dsphere spatial indexing)
	db, err := database.InitMongoDB(&cfg.DB, cfg.App.Env)
	if err != nil {
		log.Fatalf("Fatal: Database initialization failed: %v", err)
	}
	log.Println("MongoDB connected and 2dsphere indexes verified successfully")

	// 3. Initialize Redis
	redisClient, err := database.InitRedis(&cfg.Redis)
	if err != nil {
		log.Fatalf("Fatal: Redis initialization failed: %v", err)
	}
	log.Println("Redis client connected successfully")

	// 4. Initialize Cloudinary Service (optional fallback if missing keys in dev)
	var cloudinaryService cloudinary.Service
	if cfg.Cloudinary.CloudName != "" {
		cloudinaryService, err = cloudinary.NewCloudinaryService(&cfg.Cloudinary)
		if err != nil {
			log.Printf("Warning: Cloudinary initialization failed: %v", err)
		} else {
			log.Println("Cloudinary service initialized successfully")
		}
	} else {
		log.Println("Cloudinary credentials not configured; image upload will be disabled")
	}

	// 5. Initialize Repositories
	userRepo := mongoRepo.NewUserRepository(db)
	placeRepo := mongoRepo.NewPlaceRepository(db)
	otpRepo := redisRepo.NewOTPRepository(redisClient)

	// 6. Initialize Services
	authService := service.NewAuthService(userRepo, otpRepo, cfg)
	placeService := service.NewPlaceService(placeRepo)

	// 7. Initialize HTTP Handlers
	authHdl := httpHandler.NewAuthHandler(authService, userRepo)
	placeHdl := httpHandler.NewPlaceHandler(placeService)
	uploadHdl := httpHandler.NewUploadHandler(cloudinaryService)

	// 8. Initialize Fiber App
	app := fiber.New(fiber.Config{
		AppName:      cfg.App.Name,
		ServerHeader: "Fiber/FastHTTP",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		BodyLimit:    15 * 1024 * 1024, // 15MB limit for uploads
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"success": false,
				"message": err.Error(),
			})
		},
	})

	// Setup Global Middlewares
	middleware.SetupGlobalMiddlewares(app)

	// Register API Routes
	handler.RegisterRoutes(&handler.RouterConfig{
		App:           app,
		Config:        cfg,
		AuthHandler:   authHdl,
		PlaceHandler:  placeHdl,
		UploadHandler: uploadHdl,
	})

	// 9. Start Server with Graceful Shutdown
	go func() {
		addr := fmt.Sprintf(":%s", cfg.App.Port)
		if err := app.Listen(addr); err != nil {
			log.Printf("Server shut down: %v", err)
		}
	}()

	// Graceful shutdown listener
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server gracefully...")
	if err := app.ShutdownWithTimeout(10 * time.Second); err != nil {
		log.Printf("Error during server shutdown: %v", err)
	}

	// Close Redis connection
	if err := redisClient.Close(); err != nil {
		log.Printf("Error closing Redis client: %v", err)
	}

	// Close MongoDB client
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if db != nil {
		_ = db.Client().Disconnect(shutdownCtx)
	}

	log.Println("Server stopped cleanly.")
}
