package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/internal/auth"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/internal/fleet"
	"github.com/maitijit89/b-map-backend/internal/places"
	"github.com/maitijit89/b-map-backend/internal/realtime"
	"github.com/maitijit89/b-map-backend/internal/routes"
	"github.com/maitijit89/b-map-backend/internal/spatial"
	"github.com/maitijit89/b-map-backend/internal/tiles"
	"github.com/maitijit89/b-map-backend/pkg/database"
)

func main() {
	// 1. Load Configuration
	cfg := config.LoadConfig()
	log.Printf("Starting %s in %s mode on port %s", cfg.App.Name, cfg.App.Env, cfg.App.Port)

	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 2. Initialize PostgreSQL + PostGIS
	db, err := database.InitPostgres(&cfg.DB, cfg.App.Env)
	if err != nil {
		log.Fatalf("Fatal: Database initialization failed: %v", err)
	}

	// Auto-migrate all entities
	if err := db.AutoMigrate(
		&domain.User{},
		&domain.Place{},
		&domain.RoadNode{},
		&domain.RoadEdge{},
		&domain.Vehicle{},
		&domain.Trip{},
		&domain.Geofence{},
	); err != nil {
		log.Fatalf("Fatal: Database auto-migration failed: %v", err)
	}
	log.Println("Database schemas auto-migrated successfully")

	// Ensure GiST spatial indexes exist
	db.Exec("CREATE INDEX IF NOT EXISTS idx_places_loc_gist ON places USING GIST (location);")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_vehicles_loc_gist ON vehicles USING GIST (location);")

	// Seed sample map data if database is empty
	places.SeedInitialData(db)

	// 3. Initialize Redis
	rdb, err := database.InitRedis(&cfg.Redis)
	if err != nil {
		log.Fatalf("Fatal: Redis initialization failed: %v", err)
	}
	log.Println("Redis connected successfully")

	// 4. Initialize Core Engines
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Real-Time WebSocket & Redis PubSub Hub
	hub := realtime.NewHub(rdb)
	go hub.Run(ctx)

	// Spatial Indexer
	spatialIndexer := spatial.NewSpatialIndexer(rdb)

	// Routes Engine (A* + Turn-by-Turn + Map Matching)
	routesEngine := routes.NewRoutesEngine(db)

	// Fleet Engine (Driver Tracking + Trip Dispatching)
	fleetService := fleet.NewFleetService(db, spatialIndexer, routesEngine, hub)

	// Places Engine (Full-text + Proximity + Autocomplete)
	placesService := places.NewPlacesService(db)

	// Map Tiles Engine (Dynamic PostGIS ST_AsMVT Server)
	tileService := tiles.NewTileService(db, rdb)

	// Auth & OTP Service
	otpService := auth.NewOTPService(rdb)
	jwtService := auth.NewJWTService()

	// 5. Initialize Handlers
	authHdl := auth.NewAuthHandler(otpService, jwtService, db)
	routesHdl := routes.NewHandler(routesEngine)
	fleetHdl := fleet.NewHandler(fleetService, hub)
	placesHdl := places.NewHandler(placesService)
	tileHdl := tiles.NewHandler(tileService)

	// 6. Setup Gin Router & Middlewares
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		SkipPaths: []string{"/health"},
	}))

	// CORS Setup
	router.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type", "Cache-Control"},
		MaxAge:           12 * time.Hour,
	}))

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"app":       cfg.App.Name,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"version":   "1.0.0",
		})
	})

	// 7. Register API v1 Route Groups
	api := router.Group("/api/v1")
	{
		// Auth Routes
		authRoutes := api.Group("/auth")
		{
			authRoutes.POST("/login", authHdl.RequestOTP)
			authRoutes.POST("/verify", authHdl.VerifyOTP)
			authRoutes.GET("/me", auth.AuthMiddleware(), authHdl.GetProfile)
		}

		// Routing & Turn-by-Turn Navigation Routes
		routeRoutes := api.Group("/routes")
		{
			routeRoutes.GET("/directions", routesHdl.GetDirections)
			routeRoutes.POST("/progress", routesHdl.TrackProgress) // Map matching, ETA, auto-reroute
		}

		// Places & Spatial Search Routes
		placeRoutes := api.Group("/places")
		{
			placeRoutes.GET("/search", placesHdl.SearchPlaces)
			placeRoutes.GET("/autocomplete", placesHdl.Autocomplete)
			placeRoutes.GET("/reverse", placesHdl.ReverseGeocode)
			placeRoutes.POST("/", auth.AuthMiddleware(), placesHdl.CreatePlace)
		}

		// Fleet & Real-Time Telemetry Routes
		fleetRoutes := api.Group("/fleet")
		{
			fleetRoutes.POST("/location", fleetHdl.UpdateLocation)
			fleetRoutes.GET("/nearby-drivers", fleetHdl.GetNearbyDrivers)
			fleetRoutes.POST("/trips", auth.AuthMiddleware(), fleetHdl.RequestTrip)
			fleetRoutes.POST("/trips/:id/accept", auth.AuthMiddleware(), fleetHdl.AcceptTrip)
			fleetRoutes.POST("/trips/:id/complete", auth.AuthMiddleware(), fleetHdl.CompleteTrip)
			fleetRoutes.GET("/trips/:id", fleetHdl.GetTripByID)
			fleetRoutes.GET("/ws", fleetHdl.WebSocketEndpoint) // WebSocket stream
		}

		// Dynamic Mapbox Vector Tile (MVT) Server
		tileRoutes := api.Group("/tiles")
		{
			tileRoutes.GET("/:z/:x/:y", tileHdl.ServeTile)
		}
	}

	// 8. Start HTTP Server with Graceful Shutdown
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.App.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("B-Map Server listening on http://localhost:%s", cfg.App.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	_ = rdb.Close()
	sqlDB, err := db.DB()
	if err == nil {
		_ = sqlDB.Close()
	}

	log.Println("B-Map Server exited cleanly.")
}
