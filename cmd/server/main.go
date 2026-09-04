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

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/internal/admin"
	"github.com/maitijit89/b-map-backend/internal/analytics"
	"github.com/maitijit89/b-map-backend/internal/auth"
	"github.com/maitijit89/b-map-backend/internal/boundaries"
	"github.com/maitijit89/b-map-backend/internal/digipin"
	"github.com/maitijit89/b-map-backend/internal/emergency"
	"github.com/maitijit89/b-map-backend/internal/environment"
	"github.com/maitijit89/b-map-backend/internal/evcharging"
	"github.com/maitijit89/b-map-backend/internal/fare"
	"github.com/maitijit89/b-map-backend/internal/fleet"
	"github.com/maitijit89/b-map-backend/internal/geocoding"
	"github.com/maitijit89/b-map-backend/internal/geoextras"
	"github.com/maitijit89/b-map-backend/internal/hdmap"
	"github.com/maitijit89/b-map-backend/internal/lanelevel"
	"github.com/maitijit89/b-map-backend/internal/maps"
	"github.com/maitijit89/b-map-backend/internal/navic"
	"github.com/maitijit89/b-map-backend/internal/obfuscation"
	"github.com/maitijit89/b-map-backend/internal/offline"
	"github.com/maitijit89/b-map-backend/internal/pincode"
	"github.com/maitijit89/b-map-backend/internal/places"
	"github.com/maitijit89/b-map-backend/internal/rating"
	"github.com/maitijit89/b-map-backend/internal/realtime"
	mongoRepo "github.com/maitijit89/b-map-backend/internal/repository/mongodb"
	"github.com/maitijit89/b-map-backend/internal/roadhazards"
	"github.com/maitijit89/b-map-backend/internal/routes"
	"github.com/maitijit89/b-map-backend/internal/server"
	"github.com/maitijit89/b-map-backend/internal/spatial"
	"github.com/maitijit89/b-map-backend/internal/tiles"
	"github.com/maitijit89/b-map-backend/internal/toll"
	"github.com/maitijit89/b-map-backend/internal/traffic"
	"github.com/maitijit89/b-map-backend/internal/v2x"
	"github.com/maitijit89/b-map-backend/internal/vernacular"
	"github.com/maitijit89/b-map-backend/internal/version"
	"github.com/maitijit89/b-map-backend/internal/weather"
	"github.com/maitijit89/b-map-backend/pkg/database"
	"github.com/maitijit89/b-map-backend/pkg/email"
	"github.com/maitijit89/b-map-backend/pkg/googlemaps"
	"github.com/maitijit89/b-map-backend/pkg/keepalive"
)

func main() {
	// 1. Load Configuration
	cfg := config.LoadConfig()
	log.Printf("Starting %s for Indian Navigation Ecosystem in %s mode on port %s", cfg.App.Name, cfg.App.Env, cfg.App.Port)

	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 2. Initialize MongoDB with 2dsphere Spatial Indexing
	db, err := database.InitMongoDB(&cfg.DB, cfg.App.Env)
	if err != nil {
		log.Fatalf("Fatal: Database initialization failed: %v", err)
	}

	// Seed sample Indian map data and landmarks
	places.SeedInitialData(db)

	// 3. Initialize Redis
	rdb, err := database.InitRedis(&cfg.Redis)
	if err != nil {
		log.Fatalf("Fatal: Redis initialization failed: %v", err)
	}
	log.Println("Redis connected successfully")

	// 4. Initialize Repositories
	userRepo := mongoRepo.NewUserRepository(db)
	ratingRepo := mongoRepo.NewRatingRepository(db)

	// 5. Initialize Core Lifecycle Context & Infrastructure Services
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	emailService := email.NewSMTPService(&cfg.SMTP)
	_ = googlemaps.NewClient(&cfg.GoogleMaps)

	// Keep-Alive Anti-Sleep Heartbeat Worker (2-minute periodic self-ping)
	keepAliveWorker := keepalive.NewWorker(&cfg.KeepAlive)
	keepAliveWorker.Start(ctx)

	// Real-Time WebSocket & Redis PubSub Hub
	hub := realtime.NewHub(rdb)
	go hub.Run(ctx)

	// Spatial Indexer
	spatialIndexer := spatial.NewSpatialIndexer(rdb)

	// Routes Engine (A* + Contraction Hierarchies + Multi-Modal Transit + Turn-by-Turn + Map Matching + Distance Matrix + Roads)
	routesEngine := routes.NewRoutesEngine(db)

	// Fleet Engine (Driver Tracking + Trip Dispatching)
	fleetService := fleet.NewFleetService(db, spatialIndexer, routesEngine, hub)

	// Places Engine (Full-text + Proximity + Autocomplete with MongoDB 2dsphere)
	placesService := places.NewPlacesService(db)

	// Map Tiles Engine (Dynamic Vector Tile Server with L1/L2 Caching)
	tileService := tiles.NewTileService(db, rdb)

	// Geocoding & Address Validation Service
	geocodingService := geocoding.NewGeocodingService(db)

	// Geolocation, Elevation & TimeZone Service
	geoExtrasService := geoextras.NewGeoExtrasService()

	// Environmental Intelligence Service (Air Quality, Solar, Pollen)
	envService := environment.NewEnvironmentService()

	// Territorial Boundaries & Survey of India (SOI) Red Line Service
	boundaryService := boundaries.NewBoundaryService(db)

	// V2X Municipal SPaT & GLOSA Traffic Light Service
	v2xService := v2x.NewV2XService()

	// Lane-Level Positioning & RTK Ground Enhancement Service
	laneService := lanelevel.NewLaneLevelService()

	// Coordinate Obfuscation & Differential Privacy Service
	obfuscationService := obfuscation.NewObfuscationService()

	// HD Map Autonomous Driving Data-Loop Service
	hdMapService := hdmap.NewHDMapService()

	// Real-Time Traffic & Dynamic ETA Engine (with Manual Override capability)
	trafficService := traffic.NewTrafficService()

	// Offline Sync & Bounding Box Bundle Service
	offlineService := offline.NewOfflineService(db)

	// Indian Navigation Ecosystem Specialized Engines
	navicService := navic.NewNavICService()
	tollService := toll.NewTollService()
	pincodeService := pincode.NewPINCodeService()
	hazardService := roadhazards.NewHazardService()
	vernacularService := vernacular.NewVernacularService()
	evService := evcharging.NewEVService()
	emergencyService := emergency.NewEmergencyService()
	digipinService := digipin.NewDIGIPINService()
	fareService := fare.NewFareService()
	weatherService := weather.NewWeatherService()

	// Analytics, Rating & Admin Command Center Services
	analyticsService := analytics.NewAnalyticsService(db, rdb)
	ratingService := rating.NewRatingService(ratingRepo)
	adminService := admin.NewAdminService(userRepo, ratingService, analyticsService, weatherService, trafficService)

	// Auth & OTP Service (with 90s cooldown & role claims)
	otpService := auth.NewOTPService(rdb)
	jwtService := auth.NewJWTService(&cfg.JWT, rdb)
	authMiddleware := auth.AuthMiddleware(jwtService)

	// Application Version & Update Management Service
	versionService := version.NewVersionService(cfg.App.Version, db, rdb)

	// 6. Setup Router & Register Route Groups
	router := server.SetupRouter(server.RouterConfig{
		Config:           cfg,
		AuthMiddleware:   authMiddleware,
		AnalyticsService: analyticsService,
		VersionService:   versionService,
		AuthHdl:          auth.NewAuthHandler(otpService, jwtService, emailService, db),
		AdminHdl:         admin.NewHandler(adminService, analyticsService, weatherService, trafficService, ratingService),
		RatingHdl:        rating.NewHandler(ratingService, userRepo),
		MapsHdl:          maps.NewHandler(db, cfg),
		BoundaryHdl:      boundaries.NewHandler(boundaryService),
		NavICHdl:         navic.NewHandler(navicService),
		TollHdl:          toll.NewHandler(tollService),
		PINCodeHdl:       pincode.NewHandler(pincodeService),
		EVHdl:            evcharging.NewHandler(evService),
		EmergencyHdl:     emergency.NewHandler(emergencyService),
		DIGIPINHdl:       digipin.NewHandler(digipinService),
		FareHdl:          fare.NewHandler(fareService),
		WeatherHdl:       weather.NewHandler(weatherService),
		HazardHdl:        roadhazards.NewHandler(hazardService),
		VernacularHdl:    vernacular.NewHandler(vernacularService),
		TrafficHdl:       traffic.NewHandler(trafficService),
		OfflineHdl:       offline.NewHandler(offlineService),
		V2XHdl:           v2x.NewHandler(v2xService),
		LaneHdl:          lanelevel.NewHandler(laneService),
		ObfuscationHdl:   obfuscation.NewHandler(obfuscationService),
		HDMapHdl:         hdmap.NewHandler(hdMapService),
		RoutesHdl:        routes.NewHandler(routesEngine),
		GeocodingHdl:     geocoding.NewHandler(geocodingService),
		GeoExtrasHdl:     geoextras.NewHandler(geoExtrasService),
		PlacesHdl:        places.NewHandler(placesService),
		EnvHdl:           environment.NewHandler(envService),
		FleetHdl:         fleet.NewHandler(fleetService, hub),
		TileHdl:          tiles.NewHandler(tileService),
		VersionHdl:       version.NewHandler(versionService),
	})

	// 7. Start HTTP Server with Graceful Shutdown
	srv := &http.Server{
		Addr:              fmt.Sprintf(":%s", cfg.App.Port),
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
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
	if db != nil {
		_ = db.Client().Disconnect(shutdownCtx)
	}

	log.Println("B-Map Server exited cleanly.")
}
