package server

import (
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/internal/admin"
	"github.com/maitijit89/b-map-backend/internal/analytics"
	"github.com/maitijit89/b-map-backend/internal/auth"
	"github.com/maitijit89/b-map-backend/internal/boundaries"
	"github.com/maitijit89/b-map-backend/internal/dashboard"
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
	"github.com/maitijit89/b-map-backend/internal/roadhazards"
	"github.com/maitijit89/b-map-backend/internal/routes"
	"github.com/maitijit89/b-map-backend/internal/tiles"
	"github.com/maitijit89/b-map-backend/internal/toll"
	"github.com/maitijit89/b-map-backend/internal/traffic"
	"github.com/maitijit89/b-map-backend/internal/v2x"
	"github.com/maitijit89/b-map-backend/internal/vernacular"
	"github.com/maitijit89/b-map-backend/internal/version"
	"github.com/maitijit89/b-map-backend/internal/weather"
	"github.com/maitijit89/b-map-backend/pkg/metrics"
	"github.com/maitijit89/b-map-backend/pkg/middleware"
)

// RouterConfig contains all dependencies and handlers required to construct the HTTP router.
type RouterConfig struct {
	Config           *config.Config
	AuthMiddleware   gin.HandlerFunc
	AnalyticsService analytics.Service
	VersionService   version.Service

	// Handlers
	AuthHdl *auth.AuthHandler
	AdminHdl       *admin.Handler
	RatingHdl      *rating.Handler
	MapsHdl        *maps.Handler
	BoundaryHdl    *boundaries.Handler
	NavICHdl       *navic.Handler
	TollHdl        *toll.Handler
	PINCodeHdl     *pincode.Handler
	EVHdl          *evcharging.Handler
	EmergencyHdl   *emergency.Handler
	DIGIPINHdl     *digipin.Handler
	FareHdl        *fare.Handler
	WeatherHdl     *weather.Handler
	HazardHdl      *roadhazards.Handler
	VernacularHdl  *vernacular.Handler
	TrafficHdl     *traffic.Handler
	OfflineHdl     *offline.Handler
	V2XHdl         *v2x.Handler
	LaneHdl        *lanelevel.Handler
	ObfuscationHdl *obfuscation.Handler
	HDMapHdl       *hdmap.Handler
	RoutesHdl      *routes.Handler
	GeocodingHdl   *geocoding.Handler
	GeoExtrasHdl   *geoextras.Handler
	PlacesHdl      *places.Handler
	EnvHdl         *environment.Handler
	FleetHdl       *fleet.Handler
	TileHdl        *tiles.Handler
	VersionHdl     *version.Handler
}

// SetupRouter initializes Gin, attaches middlewares, registers landing page, health check, and all 31 API v1 route groups.
func SetupRouter(c RouterConfig) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestIDMiddleware())
	router.Use(middleware.SecurityHeadersMiddleware())
	router.Use(middleware.GzipMiddleware())
	router.Use(metrics.MetricsMiddleware())
	router.Use(middleware.FeatureTrackerMiddleware(c.AnalyticsService))
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
	router.GET("/favicon.ico", func(ctx *gin.Context) {
		ctx.Status(http.StatusNoContent)
	})

	// Root Landing Dashboard
	router.GET("/", dashboard.Handler(c.Config, c.VersionService))

	// Health check endpoint
	router.GET("/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"database":  "MongoDB 7.0 (2dsphere geospatial)",
			"app":       c.Config.App.Name,
			"ecosystem": "Indian Regional Navigation Ecosystem (NavIC/GAGAN/FASTag/EV/1033 SOS/DIGIPIN)",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"version":   c.VersionService.GetActiveVersion(),
		})
	})

	// Prometheus Metrics endpoint
	router.GET("/metrics", metrics.MetricsHandler())

	// Register API v1 Route Groups
	api := router.Group("/api/v1")
	{
		api.GET("/metrics", metrics.MetricsHandler())

		// 1. Authentication Lifecycle Routes (Passwordless 90s Email OTP + Telemetry)
		authRoutes := api.Group("/auth")
		{
			authRoutes.POST("/login", c.AuthHdl.RequestOTP)
			authRoutes.POST("/request-otp", c.AuthHdl.RequestOTP)
			authRoutes.POST("/verify", c.AuthHdl.VerifyOTP)
			authRoutes.POST("/refresh", c.AuthHdl.RefreshToken)
			authRoutes.POST("/logout", c.AuthMiddleware, c.AuthHdl.Logout)
			authRoutes.GET("/me", c.AuthMiddleware, c.AuthHdl.GetProfile)
			authRoutes.PUT("/profile", c.AuthMiddleware, c.AuthHdl.UpdateProfile)
			authRoutes.POST("/telemetry", c.AuthMiddleware, c.AuthHdl.UpdateTelemetry)
			authRoutes.POST("/heartbeat", c.AuthMiddleware, c.AuthHdl.UpdateTelemetry)

			// Dedicated Administrator Login (OTP strictly sent to maitidebjit2@gmail.com)
			authRoutes.POST("/admin/request-otp", c.AuthHdl.RequestAdminOTP)
			authRoutes.POST("/admin/login", c.AuthHdl.RequestAdminOTP)
			authRoutes.POST("/admin/verify", c.AuthHdl.VerifyAdminOTP)
		}

		// 2. Admin Command Center Management & Analytics (Protected: Admin Role Required)
		adminRoutes := api.Group("/admin")
		adminRoutes.Use(c.AuthMiddleware, auth.AdminMiddleware())
		{
			adminRoutes.GET("/overview", c.AdminHdl.GetOverview)
			adminRoutes.GET("/analytics/users", c.AdminHdl.GetUserAnalyticsGraph)
			adminRoutes.GET("/analytics/feature-usage", c.AdminHdl.GetFeatureUsageGraph)
			adminRoutes.GET("/ratings", c.RatingHdl.GetAdminRatings)

			adminRoutes.GET("/users", c.AdminHdl.ListUsers)
			adminRoutes.GET("/users/active", c.AdminHdl.GetActiveUsers)
			adminRoutes.GET("/users/:id", c.AdminHdl.GetUserByID)
			adminRoutes.PATCH("/users/:id/status", c.AdminHdl.UpdateUserStatus)
			adminRoutes.DELETE("/users/:id", c.AdminHdl.DeleteUser)

			adminRoutes.POST("/weather/override", c.AdminHdl.SetWeatherOverride)
			adminRoutes.GET("/weather/overrides", c.AdminHdl.GetWeatherOverrides)
			adminRoutes.DELETE("/weather/override/:name", c.AdminHdl.DeleteWeatherOverride)

			adminRoutes.POST("/traffic/override", c.AdminHdl.SetTrafficOverride)
			adminRoutes.GET("/traffic/overrides", c.AdminHdl.GetTrafficOverrides)
			adminRoutes.DELETE("/traffic/override/:id", c.AdminHdl.DeleteTrafficOverride)

			// Admin App Version & Dynamic Update Management
			adminRoutes.GET("/version", c.VersionHdl.GetVersion)
			adminRoutes.PATCH("/version", c.VersionHdl.PatchVersion)
			adminRoutes.PUT("/version", c.VersionHdl.PatchVersion)
		}

		// 3. User App Ratings & Feedback System
		ratingRoutes := api.Group("/ratings")
		{
			ratingRoutes.POST("", c.AuthMiddleware, c.RatingHdl.SubmitRating)
			ratingRoutes.GET("/my-rating", c.AuthMiddleware, c.RatingHdl.GetMyRating)
		}

		// 4. Maps, Styles, Static Maps, Clustering, Street View & 3D Tiles
		mapRoutes := api.Group("/maps")
		{
			mapRoutes.GET("/style.json", c.MapsHdl.GetStyleJSON)
			mapRoutes.GET("/static", c.MapsHdl.GetStaticMap)
			mapRoutes.GET("/clusters", c.MapsHdl.GetClusters)
			mapRoutes.GET("/streetview/metadata", c.MapsHdl.GetStreetView)
			mapRoutes.GET("/3d-tiles/tileset.json", c.MapsHdl.Get3DTileset)
		}

		// 5. Official Territorial Red Borders (Survey of India / SOI Mandated) & Search Highlighting
		boundaryRoutes := api.Group("/boundaries")
		{
			boundaryRoutes.GET("/territorial", c.BoundaryHdl.GetTerritorialBorders)
			boundaryRoutes.GET("/highlight", c.BoundaryHdl.GetRegionHighlight)
		}

		// 6. NavIC (IRNSS) & GAGAN SBAS Regional Positioning Routes
		navicRoutes := api.Group("/navic")
		{
			navicRoutes.POST("/fix", c.NavICHdl.ProcessFix)
			navicRoutes.GET("/constellation", c.NavICHdl.GetConstellation)
		}

		// 7. FASTag Toll Calculation & National Expressway Routes
		tollRoutes := api.Group("/tolls")
		{
			tollRoutes.POST("/calculate", c.TollHdl.CalculateTolls)
			tollRoutes.GET("/nearby", c.TollHdl.GetNearbyPlazas)
		}

		// 8. Indian PIN Code Spatial Lookup & Landmark-Centric Address Parser
		pincodeRoutes := api.Group("/pincode")
		{
			pincodeRoutes.GET("/:pincode", c.PINCodeHdl.LookupPINCode)
			pincodeRoutes.POST("/parse-address", c.PINCodeHdl.ParseAddress)
			pincodeRoutes.GET("/reverse", c.PINCodeHdl.ReverseLookup)
		}

		// 9. Indian EV Charging & Battery Swapping Networks
		evRoutes := api.Group("/ev")
		{
			evRoutes.GET("/stations", c.EVHdl.GetNearbyStations)
			evRoutes.GET("/stations/:id", c.EVHdl.GetStationByID)
		}

		// 10. 112 National Emergency & 1033 NHAI Highway SOS System
		emergencyRoutes := api.Group("/emergency")
		{
			emergencyRoutes.POST("/sos", c.EmergencyHdl.TriggerSOS)
			emergencyRoutes.GET("/facilities", c.EmergencyHdl.GetNearbyFacilities)
		}

		// 11. India Post DIGIPIN & Plus Code Micro-Grid
		digipinRoutes := api.Group("/digipin")
		{
			digipinRoutes.GET("/encode", c.DIGIPINHdl.EncodeCoordinates)
			digipinRoutes.GET("/decode/:code", c.DIGIPINHdl.DecodeCode)
		}

		// 12. Indian Metered Auto-Rickshaw & Cab Fare Estimator
		fareRoutes := api.Group("/fares")
		{
			fareRoutes.POST("/estimate", c.FareHdl.EstimateFares)
		}

		// 13. IMD Weather Radar & Winter Dense Fog Highway Visibility Alerts
		weatherRoutes := api.Group("/weather")
		{
			weatherRoutes.GET("/highway", c.WeatherHdl.GetHighwayWeather)
		}

		// 14. Indian Road Hazards (Unmarked Speed Breakers, Monsoon Waterlogging, Potholes)
		hazardRoutes := api.Group("/hazards")
		{
			hazardRoutes.GET("/ahead", c.HazardHdl.GetAheadHazards)
			hazardRoutes.POST("/report", c.AuthMiddleware, c.HazardHdl.ReportHazard)
		}

		// 15. Vernacular Multilingual Voice Prompts (10 Indian Languages)
		vernacularRoutes := api.Group("/vernacular")
		{
			vernacularRoutes.POST("/prompt", c.VernacularHdl.TranslatePrompt)
			vernacularRoutes.GET("/languages", c.VernacularHdl.GetLanguages)
		}

		// 16. Real-Time Traffic & Dynamic ETA Engine
		trafficRoutes := api.Group("/traffic")
		{
			trafficRoutes.POST("/telemetry", c.TrafficHdl.IngestTelemetry)
			trafficRoutes.GET("/segments/nearby", c.TrafficHdl.GetNearbyTraffic)
			trafficRoutes.POST("/evaluate-eta", c.TrafficHdl.EvaluateLiveETA)
		}

		// 17. Offline Sync & Bounding Box Downloads
		offlineRoutes := api.Group("/offline")
		{
			offlineRoutes.POST("/bundles", c.OfflineHdl.CreateBundle)
			offlineRoutes.GET("/bundles/:id", c.OfflineHdl.GetBundleManifest)
			offlineRoutes.GET("/bundles/:id/download", c.OfflineHdl.DownloadBundle)
		}

		// 18. V2X Municipal Traffic Light (SPaT) & GLOSA Speed Advisory
		v2xRoutes := api.Group("/v2x")
		{
			v2xRoutes.GET("/spat/:id", c.V2XHdl.GetSignalSPaT)
			v2xRoutes.GET("/signals/nearby", c.V2XHdl.GetNearbySignals)
			v2xRoutes.POST("/glosa/advisory", c.V2XHdl.GetGLOSAAdvisory)
		}

		// 19. Ground Enhancement (RTK / GNSS) & Lane-Level Positioning
		laneRoutes := api.Group("/lanelevel")
		{
			laneRoutes.POST("/rtk/correct", c.LaneHdl.CorrectRTK)
			laneRoutes.GET("/guidance", c.LaneHdl.GetLaneGuidance)
		}

		// 20. Coordinate Obfuscation (GCJ-02/BD-09) & Differential Privacy
		obfuscationRoutes := api.Group("/obfuscation")
		{
			obfuscationRoutes.POST("/transform", c.ObfuscationHdl.Transform)
			obfuscationRoutes.POST("/fuzz", c.ObfuscationHdl.Fuzz)
		}

		// 21. HD Map Autonomous Driving Data-Loop
		hdMapRoutes := api.Group("/hdmap")
		{
			hdMapRoutes.POST("/observations", c.HDMapHdl.IngestObservation)
			hdMapRoutes.GET("/changes/nearby", c.HDMapHdl.GetActiveChanges)
		}

		// 22. Routing, Directions, Distance Matrix, Navigation Session
		routeRoutes := api.Group("/routes")
		{
			routeRoutes.GET("/directions", c.RoutesHdl.GetDirections)
			routeRoutes.GET("/distance-matrix", c.RoutesHdl.GetDistanceMatrix)
			routeRoutes.POST("/progress", c.RoutesHdl.TrackProgress)
		}

		// 23. Roads API (Snap to Roads, Speed Limits)
		roadRoutes := api.Group("/roads")
		{
			roadRoutes.POST("/snap-to-roads", c.RoutesHdl.SnapToRoads)
			roadRoutes.GET("/speed-limits", c.RoutesHdl.GetSpeedLimits)
		}

		// 24. Geocoding & Reverse Geocoding
		geocodeRoutes := api.Group("/geocoding")
		{
			geocodeRoutes.GET("/geocode", c.GeocodingHdl.Geocode)
			geocodeRoutes.GET("/reverse", c.GeocodingHdl.ReverseGeocode)
		}

		// 25. Address Validation API
		addressRoutes := api.Group("/address")
		{
			addressRoutes.POST("/validate", c.GeocodingHdl.ValidateAddress)
		}

		// 26. Geolocation, Elevation & TimeZone APIs
		api.POST("/geolocation", c.GeoExtrasHdl.Geolocation)
		api.GET("/elevation", c.GeoExtrasHdl.GetElevation)
		api.GET("/timezone", c.GeoExtrasHdl.GetTimeZone)

		// 27. Places & Spatial Search Routes
		placeRoutes := api.Group("/places")
		{
			placeRoutes.GET("/search", c.PlacesHdl.SearchPlaces)
			placeRoutes.GET("/autocomplete", c.PlacesHdl.Autocomplete)
			placeRoutes.GET("/reverse", c.PlacesHdl.ReverseGeocode)
			placeRoutes.POST("", c.AuthMiddleware, c.PlacesHdl.CreatePlace)
		}

		// 28. Environmental Intelligence APIs (Air Quality, Solar, Pollen)
		envRoutes := api.Group("/environment")
		{
			envRoutes.GET("/air-quality", c.EnvHdl.GetAirQuality)
			envRoutes.POST("/air-quality", c.EnvHdl.GetAirQuality)
			envRoutes.GET("/solar", c.EnvHdl.GetSolar)
			envRoutes.GET("/pollen", c.EnvHdl.GetPollen)
		}

		// 29. Fleet & Real-Time Telemetry Routes
		fleetRoutes := api.Group("/fleet")
		{
			fleetRoutes.POST("/location", c.FleetHdl.UpdateLocation)
			fleetRoutes.GET("/nearby-drivers", c.FleetHdl.GetNearbyDrivers)
			fleetRoutes.POST("/trips", c.AuthMiddleware, c.FleetHdl.RequestTrip)
			fleetRoutes.POST("/trips/:id/accept", c.AuthMiddleware, c.FleetHdl.AcceptTrip)
			fleetRoutes.POST("/trips/:id/complete", c.AuthMiddleware, c.FleetHdl.CompleteTrip)
			fleetRoutes.GET("/trips/:id", c.FleetHdl.GetTripByID)
			fleetRoutes.GET("/ws", c.FleetHdl.WebSocketEndpoint)
		}

		// 30. Dynamic Mapbox Vector Tile (MVT) Server
		tileRoutes := api.Group("/tiles")
		{
			tileRoutes.GET("/:z/:x/:y", c.TileHdl.ServeTile)
		}

		// 31. Application Version & Dynamic Update Patching Routes
		appRoutes := api.Group("/app")
		{
			appRoutes.GET("/version", c.VersionHdl.GetVersion)
			appRoutes.GET("/check-update", c.VersionHdl.CheckUpdate)
			appRoutes.PATCH("/version", c.VersionHdl.PatchVersion)
		}
		api.GET("/version", c.VersionHdl.GetVersion)
	}

	return router
}
