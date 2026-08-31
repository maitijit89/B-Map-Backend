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
	"github.com/maitijit89/b-map-backend/internal/spatial"
	"github.com/maitijit89/b-map-backend/internal/tiles"
	"github.com/maitijit89/b-map-backend/internal/toll"
	"github.com/maitijit89/b-map-backend/internal/traffic"
	"github.com/maitijit89/b-map-backend/internal/v2x"
	"github.com/maitijit89/b-map-backend/internal/vernacular"
	"github.com/maitijit89/b-map-backend/internal/weather"
	"github.com/maitijit89/b-map-backend/pkg/database"
	"github.com/maitijit89/b-map-backend/pkg/email"
	"github.com/maitijit89/b-map-backend/pkg/googlemaps"
	"github.com/maitijit89/b-map-backend/pkg/keepalive"
	"github.com/maitijit89/b-map-backend/pkg/metrics"
	"github.com/maitijit89/b-map-backend/pkg/middleware"
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

	// --- Indian Navigation Ecosystem Specialized Engines ---
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

	// 6. Initialize Handlers
	authHdl := auth.NewAuthHandler(otpService, jwtService, emailService, db)
	routesHdl := routes.NewHandler(routesEngine)
	fleetHdl := fleet.NewHandler(fleetService, hub)
	placesHdl := places.NewHandler(placesService)
	tileHdl := tiles.NewHandler(tileService)
	mapsHdl := maps.NewHandler(db, cfg)
	geocodingHdl := geocoding.NewHandler(geocodingService)
	geoExtrasHdl := geoextras.NewHandler(geoExtrasService)
	envHdl := environment.NewHandler(envService)
	boundaryHdl := boundaries.NewHandler(boundaryService)
	v2xHdl := v2x.NewHandler(v2xService)
	laneHdl := lanelevel.NewHandler(laneService)
	obfuscationHdl := obfuscation.NewHandler(obfuscationService)
	hdMapHdl := hdmap.NewHandler(hdMapService)
	trafficHdl := traffic.NewHandler(trafficService)
	offlineHdl := offline.NewHandler(offlineService)
	ratingHdl := rating.NewHandler(ratingService, userRepo)
	adminHdl := admin.NewHandler(adminService, analyticsService, weatherService, trafficService, ratingService)

	// Indian Ecosystem Handlers
	navicHdl := navic.NewHandler(navicService)
	tollHdl := toll.NewHandler(tollService)
	pincodeHdl := pincode.NewHandler(pincodeService)
	hazardHdl := roadhazards.NewHandler(hazardService)
	vernacularHdl := vernacular.NewHandler(vernacularService)
	evHdl := evcharging.NewHandler(evService)
	emergencyHdl := emergency.NewHandler(emergencyService)
	digipinHdl := digipin.NewHandler(digipinService)
	fareHdl := fare.NewHandler(fareService)
	weatherHdl := weather.NewHandler(weatherService)

	// 7. Setup Gin Router & High-Performance Middlewares
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestIDMiddleware())
	router.Use(middleware.SecurityHeadersMiddleware())
	router.Use(middleware.GzipMiddleware())
	router.Use(metrics.MetricsMiddleware())
	router.Use(middleware.FeatureTrackerMiddleware(analyticsService))
	router.Use(middleware.RateLimitMiddleware(150.0, 300))

	router.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		SkipPaths: []string{"/health", "/metrics"},
	}))

	// CORS Setup
	router.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With", "X-Request-ID"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type", "Cache-Control", "Content-Disposition", "X-SHA256-Checksum", "X-Request-ID"},
		MaxAge:           12 * time.Hour,
	}))

	// Favicon handler
	router.GET("/favicon.ico", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	// Root Landing Dashboard
	router.GET("/", func(c *gin.Context) {
		// If client expects JSON (e.g. curl / API client), return JSON
		if c.GetHeader("Accept") == "application/json" {
			c.JSON(http.StatusOK, gin.H{
				"name":        cfg.App.Name,
				"version":     "1.0.0",
				"status":      "running",
				"database":    "MongoDB 7.0 (2dsphere geospatial)",
				"health_url":  "/health",
				"admin_url":   "/admin",
				"api_base":    "/api/v1",
				"docs":        "https://github.com/maitijit89/B-Map-Backend",
			})
			return
		}

		// Render rich modern interactive web dashboard for browser visitors
		html := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>B-Map Navigation Backend | MongoDB & Indian Geospatial Platform</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0a0d14;
            --bg-card: rgba(18, 24, 38, 0.7);
            --border: rgba(255, 255, 255, 0.08);
            --border-hover: rgba(59, 130, 246, 0.4);
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --accent-blue: #3b82f6;
            --accent-green: #10b981;
            --accent-purple: #8b5cf6;
            --accent-gradient: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            background-image: 
                radial-gradient(circle at 15% 15%, rgba(59, 130, 246, 0.12) 0%, transparent 40%),
                radial-gradient(circle at 85% 85%, rgba(139, 92, 246, 0.12) 0%, transparent 40%);
            background-attachment: fixed;
        }
        .container {
            max-width: 1100px;
            margin: 0 auto;
            padding: 40px 24px;
            width: 100%;
        }
        header {
            text-align: center;
            margin-bottom: 40px;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #34d399;
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 600;
            margin-bottom: 16px;
        }
        .badge-dot {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            box-shadow: 0 0 10px #10b981;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
        }
        h1 {
            font-size: 3rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
        }
        .subtitle {
            font-size: 1.15rem;
            color: var(--text-muted);
            max-width: 650px;
            margin: 0 auto;
            line-height: 1.6;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 16px;
            margin-bottom: 36px;
        }
        .status-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
            backdrop-filter: blur(12px);
            transition: all 0.2s ease;
        }
        .status-card:hover {
            border-color: var(--border-hover);
            transform: translateY(-2px);
        }
        .status-title {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            margin-bottom: 6px;
        }
        .status-val {
            font-size: 1.1rem;
            font-weight: 700;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .endpoints-section {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 32px;
            backdrop-filter: blur(16px);
        }
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }
        .section-title {
            font-size: 1.35rem;
            font-weight: 700;
        }
        .endpoints-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 14px;
        }
        .endpoint-btn {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 14px 18px;
            text-decoration: none;
            color: var(--text-main);
            transition: all 0.2s ease;
        }
        .endpoint-btn:hover {
            background: rgba(59, 130, 246, 0.1);
            border-color: var(--accent-blue);
            transform: translateY(-2px);
        }
        .method-get {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            font-weight: 700;
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            padding: 4px 8px;
            border-radius: 6px;
            margin-right: 10px;
        }
        .endpoint-path {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            color: #e2e8f0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .endpoint-desc {
            font-size: 0.8rem;
            color: var(--text-muted);
            margin-top: 4px;
        }
        footer {
            margin-top: auto;
            text-align: center;
            padding: 24px;
            font-size: 0.85rem;
            color: var(--text-muted);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="badge">
                <span class="badge-dot"></span>
                <span>SYSTEM ACTIVE & HEALTHY</span>
            </div>
            <h1>B-Map Navigation Backend</h1>
            <p class="subtitle">Next-generation enterprise navigation, Contraction Hierarchies pathfinding, and Indian Regional Navigation Ecosystem powered by MongoDB 2dsphere & Redis.</p>
        </header>

        <div class="status-grid">
            <div class="status-card">
                <div class="status-title">Database Engine</div>
                <div class="status-val">🍃 MongoDB Atlas (2dsphere)</div>
            </div>
            <div class="status-card">
                <div class="status-title">Cache Layer</div>
                <div class="status-val">⚡ Redis (L1/L2 Multi-tier)</div>
            </div>
            <div class="status-card">
                <div class="status-title">Admin Console</div>
                <div class="status-val"><a href="/admin" style="color:#60a5fa;text-decoration:none">📊 Open Dashboard ↗</a></div>
            </div>
            <div class="status-card">
                <div class="status-title">Fast Routing</div>
                <div class="status-val">🚀 Contraction Hierarchies</div>
            </div>
        </div>

        <div class="endpoints-section">
            <div class="section-header">
                <div class="section-title">⚡ Live Interactive API Endpoints</div>
            </div>
            <div class="endpoints-grid">
                <a href="/admin" target="_blank" class="endpoint-btn" style="border-color:rgba(59,130,246,0.4)">
                    <div>
                        <span class="method-get" style="background:rgba(59,130,246,0.2);color:#60a5fa">ADMIN</span>
                        <span class="endpoint-path">/admin</span>
                        <div class="endpoint-desc">Admin Command Center & Live User Map</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/health" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/health</span>
                        <div class="endpoint-desc">Backend health & database status</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/api/v1/places/search?q=India" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/api/v1/places/search?q=India</span>
                        <div class="endpoint-desc">Full-text MongoDB place search</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/api/v1/places/search?lat=28.6129&lng=77.2295&radius=50000" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/api/v1/places/search (Proximity)</span>
                        <div class="endpoint-desc">2dsphere 50km radius spherical search</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/api/v1/routes/directions?origin=28.6129,77.2295&destination=28.5562,77.1000&mode=driving" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/api/v1/routes/directions</span>
                        <div class="endpoint-desc">India Gate to DEL Airport driving route</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/api/v1/maps/style.json?theme=standard" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/api/v1/maps/style.json</span>
                        <div class="endpoint-desc">Mapbox Vector Style Spec v8 JSON</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/api/v1/boundaries/territorial" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/api/v1/boundaries/territorial</span>
                        <div class="endpoint-desc">Survey of India (SOI) official borders</div>
                    </div>
                    <span>↗</span>
                </a>
                <a href="/metrics" target="_blank" class="endpoint-btn">
                    <div>
                        <span class="method-get">GET</span>
                        <span class="endpoint-path">/metrics</span>
                        <div class="endpoint-desc">Prometheus performance metrics</div>
                    </div>
                    <span>↗</span>
                </a>
            </div>
        </div>

        <footer>
            B-Map Platform Backend &bull; Developed with Go 1.25, MongoDB Atlas & Redis
        </footer>
    </div>
</body>
</html>`
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.String(http.StatusOK, html)
	})

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"database":  "MongoDB 7.0 (2dsphere geospatial)",
			"app":       cfg.App.Name,
			"ecosystem": "Indian Regional Navigation Ecosystem (NavIC/GAGAN/FASTag/EV/1033 SOS/DIGIPIN)",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"version":   "1.0.0",
		})
	})

	// Prometheus Metrics endpoint
	router.GET("/metrics", metrics.MetricsHandler())

	// 8. Register API v1 Route Groups
	api := router.Group("/api/v1")
	{
		api.GET("/metrics", metrics.MetricsHandler())

		// 1. Authentication Lifecycle Routes (Passwordless 90s Email OTP + Telemetry)
		authRoutes := api.Group("/auth")
		{
			authRoutes.POST("/login", authHdl.RequestOTP)
			authRoutes.POST("/request-otp", authHdl.RequestOTP)
			authRoutes.POST("/verify", authHdl.VerifyOTP)
			authRoutes.POST("/refresh", authHdl.RefreshToken)
			authRoutes.POST("/logout", authMiddleware, authHdl.Logout)
			authRoutes.GET("/me", authMiddleware, authHdl.GetProfile)
			authRoutes.PUT("/profile", authMiddleware, authHdl.UpdateProfile)
			authRoutes.POST("/telemetry", authMiddleware, authHdl.UpdateTelemetry)
			authRoutes.POST("/heartbeat", authMiddleware, authHdl.UpdateTelemetry)

			// Dedicated Administrator Login (OTP strictly sent to maitidebjit2@gmail.com)
			authRoutes.POST("/admin/request-otp", authHdl.RequestAdminOTP)
			authRoutes.POST("/admin/login", authHdl.RequestAdminOTP)
			authRoutes.POST("/admin/verify", authHdl.VerifyAdminOTP)
		}

		// 2. Admin Command Center Management & Analytics (Protected: Admin Role Required)
		adminRoutes := api.Group("/admin")
		adminRoutes.Use(authMiddleware, auth.AdminMiddleware())
		{
			adminRoutes.GET("/overview", adminHdl.GetOverview)
			adminRoutes.GET("/analytics/users", adminHdl.GetUserAnalyticsGraph)
			adminRoutes.GET("/analytics/feature-usage", adminHdl.GetFeatureUsageGraph)
			adminRoutes.GET("/ratings", ratingHdl.GetAdminRatings)

			adminRoutes.GET("/users", adminHdl.ListUsers)
			adminRoutes.GET("/users/active", adminHdl.GetActiveUsers)
			adminRoutes.GET("/users/:id", adminHdl.GetUserByID)
			adminRoutes.PATCH("/users/:id/status", adminHdl.UpdateUserStatus)
			adminRoutes.DELETE("/users/:id", adminHdl.DeleteUser)

			adminRoutes.POST("/weather/override", adminHdl.SetWeatherOverride)
			adminRoutes.GET("/weather/overrides", adminHdl.GetWeatherOverrides)
			adminRoutes.DELETE("/weather/override/:name", adminHdl.DeleteWeatherOverride)

			adminRoutes.POST("/traffic/override", adminHdl.SetTrafficOverride)
			adminRoutes.GET("/traffic/overrides", adminHdl.GetTrafficOverrides)
			adminRoutes.DELETE("/traffic/override/:id", adminHdl.DeleteTrafficOverride)
		}

		// 3. User App Ratings & Feedback System
		ratingRoutes := api.Group("/ratings")
		{
			ratingRoutes.POST("", authMiddleware, ratingHdl.SubmitRating)
			ratingRoutes.GET("/my-rating", authMiddleware, ratingHdl.GetMyRating)
		}

		// 4. Maps, Styles, Static Maps, Clustering, Street View & 3D Tiles
		mapRoutes := api.Group("/maps")
		{
			mapRoutes.GET("/style.json", mapsHdl.GetStyleJSON)
			mapRoutes.GET("/static", mapsHdl.GetStaticMap)
			mapRoutes.GET("/clusters", mapsHdl.GetClusters)
			mapRoutes.GET("/streetview/metadata", mapsHdl.GetStreetView)
			mapRoutes.GET("/3d-tiles/tileset.json", mapsHdl.Get3DTileset)
		}

		// 5. Official Territorial Red Borders (Survey of India / SOI Mandated) & Search Highlighting
		boundaryRoutes := api.Group("/boundaries")
		{
			boundaryRoutes.GET("/territorial", boundaryHdl.GetTerritorialBorders)
			boundaryRoutes.GET("/highlight", boundaryHdl.GetRegionHighlight)
		}

		// 6. NavIC (IRNSS) & GAGAN SBAS Regional Positioning Routes
		navicRoutes := api.Group("/navic")
		{
			navicRoutes.POST("/fix", navicHdl.ProcessFix)
			navicRoutes.GET("/constellation", navicHdl.GetConstellation)
		}

		// 7. FASTag Toll Calculation & National Expressway Routes
		tollRoutes := api.Group("/tolls")
		{
			tollRoutes.POST("/calculate", tollHdl.CalculateTolls)
			tollRoutes.GET("/nearby", tollHdl.GetNearbyPlazas)
		}

		// 8. Indian PIN Code Spatial Lookup & Landmark-Centric Address Parser
		pincodeRoutes := api.Group("/pincode")
		{
			pincodeRoutes.GET("/:pincode", pincodeHdl.LookupPINCode)
			pincodeRoutes.POST("/parse-address", pincodeHdl.ParseAddress)
			pincodeRoutes.GET("/reverse", pincodeHdl.ReverseLookup)
		}

		// 9. Indian EV Charging & Battery Swapping Networks
		evRoutes := api.Group("/ev")
		{
			evRoutes.GET("/stations", evHdl.GetNearbyStations)
			evRoutes.GET("/stations/:id", evHdl.GetStationByID)
		}

		// 10. 112 National Emergency & 1033 NHAI Highway SOS System
		emergencyRoutes := api.Group("/emergency")
		{
			emergencyRoutes.POST("/sos", emergencyHdl.TriggerSOS)
			emergencyRoutes.GET("/facilities", emergencyHdl.GetNearbyFacilities)
		}

		// 11. India Post DIGIPIN & Plus Code Micro-Grid
		digipinRoutes := api.Group("/digipin")
		{
			digipinRoutes.GET("/encode", digipinHdl.EncodeCoordinates)
			digipinRoutes.GET("/decode/:code", digipinHdl.DecodeCode)
		}

		// 12. Indian Metered Auto-Rickshaw & Cab Fare Estimator
		fareRoutes := api.Group("/fares")
		{
			fareRoutes.POST("/estimate", fareHdl.EstimateFares)
		}

		// 13. IMD Weather Radar & Winter Dense Fog Highway Visibility Alerts
		weatherRoutes := api.Group("/weather")
		{
			weatherRoutes.GET("/highway", weatherHdl.GetHighwayWeather)
		}

		// 14. Indian Road Hazards (Unmarked Speed Breakers, Monsoon Waterlogging, Potholes)
		hazardRoutes := api.Group("/hazards")
		{
			hazardRoutes.GET("/ahead", hazardHdl.GetAheadHazards)
			hazardRoutes.POST("/report", authMiddleware, hazardHdl.ReportHazard)
		}

		// 15. Vernacular Multilingual Voice Prompts (10 Indian Languages)
		vernacularRoutes := api.Group("/vernacular")
		{
			vernacularRoutes.POST("/prompt", vernacularHdl.TranslatePrompt)
			vernacularRoutes.GET("/languages", vernacularHdl.GetLanguages)
		}

		// 16. Real-Time Traffic & Dynamic ETA Engine
		trafficRoutes := api.Group("/traffic")
		{
			trafficRoutes.POST("/telemetry", trafficHdl.IngestTelemetry)
			trafficRoutes.GET("/segments/nearby", trafficHdl.GetNearbyTraffic)
			trafficRoutes.POST("/evaluate-eta", trafficHdl.EvaluateLiveETA)
		}

		// 17. Offline Sync & Bounding Box Downloads
		offlineRoutes := api.Group("/offline")
		{
			offlineRoutes.POST("/bundles", offlineHdl.CreateBundle)
			offlineRoutes.GET("/bundles/:id", offlineHdl.GetBundleManifest)
			offlineRoutes.GET("/bundles/:id/download", offlineHdl.DownloadBundle)
		}

		// 18. V2X Municipal Traffic Light (SPaT) & GLOSA Speed Advisory
		v2xRoutes := api.Group("/v2x")
		{
			v2xRoutes.GET("/spat/:id", v2xHdl.GetSignalSPaT)
			v2xRoutes.GET("/signals/nearby", v2xHdl.GetNearbySignals)
			v2xRoutes.POST("/glosa/advisory", v2xHdl.GetGLOSAAdvisory)
		}

		// 19. Ground Enhancement (RTK / GNSS) & Lane-Level Positioning
		laneRoutes := api.Group("/lanelevel")
		{
			laneRoutes.POST("/rtk/correct", laneHdl.CorrectRTK)
			laneRoutes.GET("/guidance", laneHdl.GetLaneGuidance)
		}

		// 20. Coordinate Obfuscation (GCJ-02/BD-09) & Differential Privacy
		obfuscationRoutes := api.Group("/obfuscation")
		{
			obfuscationRoutes.POST("/transform", obfuscationHdl.Transform)
			obfuscationRoutes.POST("/fuzz", obfuscationHdl.Fuzz)
		}

		// 21. HD Map Autonomous Driving Data-Loop
		hdMapRoutes := api.Group("/hdmap")
		{
			hdMapRoutes.POST("/observations", hdMapHdl.IngestObservation)
			hdMapRoutes.GET("/changes/nearby", hdMapHdl.GetActiveChanges)
		}

		// 22. Routing, Directions, Distance Matrix, Navigation Session
		routeRoutes := api.Group("/routes")
		{
			routeRoutes.GET("/directions", routesHdl.GetDirections)
			routeRoutes.GET("/distance-matrix", routesHdl.GetDistanceMatrix)
			routeRoutes.POST("/progress", routesHdl.TrackProgress)
		}

		// 23. Roads API (Snap to Roads, Speed Limits)
		roadRoutes := api.Group("/roads")
		{
			roadRoutes.POST("/snap-to-roads", routesHdl.SnapToRoads)
			roadRoutes.GET("/speed-limits", routesHdl.GetSpeedLimits)
		}

		// 24. Geocoding & Reverse Geocoding
		geocodeRoutes := api.Group("/geocoding")
		{
			geocodeRoutes.GET("/geocode", geocodingHdl.Geocode)
			geocodeRoutes.GET("/reverse", geocodingHdl.ReverseGeocode)
		}

		// 25. Address Validation API
		addressRoutes := api.Group("/address")
		{
			addressRoutes.POST("/validate", geocodingHdl.ValidateAddress)
		}

		// 26. Geolocation, Elevation & TimeZone APIs
		api.POST("/geolocation", geoExtrasHdl.Geolocation)
		api.GET("/elevation", geoExtrasHdl.GetElevation)
		api.GET("/timezone", geoExtrasHdl.GetTimeZone)

		// 27. Places & Spatial Search Routes
		placeRoutes := api.Group("/places")
		{
			placeRoutes.GET("/search", placesHdl.SearchPlaces)
			placeRoutes.GET("/autocomplete", placesHdl.Autocomplete)
			placeRoutes.GET("/reverse", placesHdl.ReverseGeocode)
			placeRoutes.POST("", authMiddleware, placesHdl.CreatePlace)
		}

		// 28. Environmental Intelligence APIs (Air Quality, Solar, Pollen)
		envRoutes := api.Group("/environment")
		{
			envRoutes.GET("/air-quality", envHdl.GetAirQuality)
			envRoutes.POST("/air-quality", envHdl.GetAirQuality)
			envRoutes.GET("/solar", envHdl.GetSolar)
			envRoutes.GET("/pollen", envHdl.GetPollen)
		}

		// 29. Fleet & Real-Time Telemetry Routes
		fleetRoutes := api.Group("/fleet")
		{
			fleetRoutes.POST("/location", fleetHdl.UpdateLocation)
			fleetRoutes.GET("/nearby-drivers", fleetHdl.GetNearbyDrivers)
			fleetRoutes.POST("/trips", authMiddleware, fleetHdl.RequestTrip)
			fleetRoutes.POST("/trips/:id/accept", authMiddleware, fleetHdl.AcceptTrip)
			fleetRoutes.POST("/trips/:id/complete", authMiddleware, fleetHdl.CompleteTrip)
			fleetRoutes.GET("/trips/:id", fleetHdl.GetTripByID)
			fleetRoutes.GET("/ws", fleetHdl.WebSocketEndpoint)
		}

		// 30. Dynamic Mapbox Vector Tile (MVT) Server
		tileRoutes := api.Group("/tiles")
		{
			tileRoutes.GET("/:z/:x/:y", tileHdl.ServeTile)
		}
	}

	// 9. Start HTTP Server with Graceful Shutdown
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
