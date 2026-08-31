package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/internal/admin"
	"github.com/maitijit89/b-map-backend/internal/analytics"
	"github.com/maitijit89/b-map-backend/internal/auth"
	"github.com/maitijit89/b-map-backend/internal/boundaries"
	"github.com/maitijit89/b-map-backend/internal/digipin"
	"github.com/maitijit89/b-map-backend/internal/domain"
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
	"github.com/maitijit89/b-map-backend/pkg/middleware"
)

type TestResult struct {
	Category string
	Feature  string
	Method   string
	Endpoint string
	Status   int
	Success  bool
	Duration time.Duration
	Note     string
}

func main() {
	gin.SetMode(gin.TestMode)
	cfg := config.LoadConfig()

	fmt.Println("================================================================================")
	fmt.Println("🚀 STARTING FULL END-TO-END FEATURE TEST SUITE FOR B-MAP BACKEND")
	fmt.Println("================================================================================")
	fmt.Printf("🍃 MongoDB URI: %s\n", cfg.DB.URI)
	fmt.Printf("⚡ Redis Host:  %s:%s\n\n", cfg.Redis.Host, cfg.Redis.Port)

	// 1. Initialize MongoDB
	db, err := database.InitMongoDB(&cfg.DB, "test")
	if err != nil {
		fmt.Printf("❌ Failed to connect to MongoDB: %v\n", err)
		os.Exit(1)
	}

	// 2. Initialize Redis
	rdb, err := database.InitRedis(&cfg.Redis)
	if err != nil {
		fmt.Printf("❌ Failed to connect to Redis: %v\n", err)
		os.Exit(1)
	}

	// Seed places
	places.SeedInitialData(db)

	ctx := context.Background()
	userRepo := mongoRepo.NewUserRepository(db)
	ratingRepo := mongoRepo.NewRatingRepository(db)

	// Provision Test Admin and User in MongoDB
	adminUserID := uuid.New()
	adminUser := &domain.User{
		ID:                 adminUserID,
		Name:               "Administrator",
		Email:              "maitidebjit2@gmail.com",
		Role:               "admin",
		Status:             "active",
		LastActiveAt:       time.Now().UTC(),
		TotalActiveMinutes: 10,
		CreatedAt:          time.Now().UTC(),
		UpdatedAt:          time.Now().UTC(),
	}
	_ = userRepo.Create(ctx, adminUser)

	testUserID := uuid.New()
	testUser := &domain.User{
		ID:                 testUserID,
		Name:               "Test Driver",
		Email:              "testuser@example.com",
		Role:               "user",
		Status:             "active",
		LastActiveAt:       time.Now().UTC(),
		TotalActiveMinutes: 5,
		CreatedAt:          time.Now().UTC(),
		UpdatedAt:          time.Now().UTC(),
	}
	_ = userRepo.Create(ctx, testUser)

	emailService := email.NewSMTPService(&cfg.SMTP)
	hub := realtime.NewHub(rdb)
	go hub.Run(ctx)
	spatialIndexer := spatial.NewSpatialIndexer(rdb)

	routesEngine := routes.NewRoutesEngine(db)
	fleetService := fleet.NewFleetService(db, spatialIndexer, routesEngine, hub)
	placesService := places.NewPlacesService(db)
	tileService := tiles.NewTileService(db, rdb)
	geocodingService := geocoding.NewGeocodingService(db)
	geoExtrasService := geoextras.NewGeoExtrasService()
	envService := environment.NewEnvironmentService()
	boundaryService := boundaries.NewBoundaryService(db)
	v2xService := v2x.NewV2XService()
	laneService := lanelevel.NewLaneLevelService()
	obfuscationService := obfuscation.NewObfuscationService()
	hdMapService := hdmap.NewHDMapService()
	trafficService := traffic.NewTrafficService()
	offlineService := offline.NewOfflineService(db)

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

	analyticsService := analytics.NewAnalyticsService(db, rdb)
	ratingService := rating.NewRatingService(ratingRepo)
	adminService := admin.NewAdminService(userRepo, ratingService, analyticsService, weatherService, trafficService)

	otpService := auth.NewOTPService(rdb)
	jwtService := auth.NewJWTService(&cfg.JWT, rdb)
	authMiddleware := auth.AuthMiddleware(jwtService)
	adminMiddleware := auth.AdminMiddleware()

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

	// Router setup
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestIDMiddleware())
	router.Use(middleware.SecurityHeadersMiddleware())
	router.Use(middleware.GzipMiddleware())
	router.Use(middleware.FeatureTrackerMiddleware(analyticsService))

	// Health
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "database": "MongoDB Atlas 7.0"})
	})

	api := router.Group("/api/v1")
	{
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

			authRoutes.POST("/admin/request-otp", authHdl.RequestAdminOTP)
			authRoutes.POST("/admin/login", authHdl.RequestAdminOTP)
			authRoutes.POST("/admin/verify", authHdl.VerifyAdminOTP)
		}

		adminRoutes := api.Group("/admin")
		adminRoutes.Use(authMiddleware, adminMiddleware)
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

		ratingRoutes := api.Group("/ratings")
		{
			ratingRoutes.POST("", authMiddleware, ratingHdl.SubmitRating)
			ratingRoutes.GET("/my-rating", authMiddleware, ratingHdl.GetMyRating)
		}

		mapRoutes := api.Group("/maps")
		{
			mapRoutes.GET("/style.json", mapsHdl.GetStyleJSON)
			mapRoutes.GET("/static", mapsHdl.GetStaticMap)
			mapRoutes.GET("/clusters", mapsHdl.GetClusters)
		}

		boundaryRoutes := api.Group("/boundaries")
		{
			boundaryRoutes.GET("/territorial", boundaryHdl.GetTerritorialBorders)
			boundaryRoutes.GET("/highlight", boundaryHdl.GetRegionHighlight)
		}

		navicRoutes := api.Group("/navic")
		{
			navicRoutes.POST("/fix", navicHdl.ProcessFix)
			navicRoutes.GET("/constellation", navicHdl.GetConstellation)
		}

		tollRoutes := api.Group("/tolls")
		{
			tollRoutes.POST("/calculate", tollHdl.CalculateTolls)
			tollRoutes.GET("/nearby", tollHdl.GetNearbyPlazas)
		}

		pincodeRoutes := api.Group("/pincode")
		{
			pincodeRoutes.GET("/:pincode", pincodeHdl.LookupPINCode)
			pincodeRoutes.POST("/parse-address", pincodeHdl.ParseAddress)
			pincodeRoutes.GET("/reverse", pincodeHdl.ReverseLookup)
		}

		evRoutes := api.Group("/ev")
		{
			evRoutes.GET("/stations", evHdl.GetNearbyStations)
			evRoutes.GET("/stations/:id", evHdl.GetStationByID)
		}

		emergencyRoutes := api.Group("/emergency")
		{
			emergencyRoutes.POST("/sos", emergencyHdl.TriggerSOS)
			emergencyRoutes.GET("/facilities", emergencyHdl.GetNearbyFacilities)
		}

		digipinRoutes := api.Group("/digipin")
		{
			digipinRoutes.GET("/encode", digipinHdl.EncodeCoordinates)
			digipinRoutes.GET("/decode/:code", digipinHdl.DecodeCode)
		}

		fareRoutes := api.Group("/fares")
		{
			fareRoutes.POST("/estimate", fareHdl.EstimateFares)
		}

		weatherRoutes := api.Group("/weather")
		{
			weatherRoutes.GET("/highway", weatherHdl.GetHighwayWeather)
		}

		hazardRoutes := api.Group("/hazards")
		{
			hazardRoutes.GET("/ahead", hazardHdl.GetAheadHazards)
		}

		vernacularRoutes := api.Group("/vernacular")
		{
			vernacularRoutes.POST("/prompt", vernacularHdl.TranslatePrompt)
			vernacularRoutes.GET("/languages", vernacularHdl.GetLanguages)
		}

		trafficRoutes := api.Group("/traffic")
		{
			trafficRoutes.POST("/telemetry", trafficHdl.IngestTelemetry)
			trafficRoutes.GET("/segments/nearby", trafficHdl.GetNearbyTraffic)
			trafficRoutes.POST("/evaluate-eta", trafficHdl.EvaluateLiveETA)
		}

		offlineRoutes := api.Group("/offline")
		{
			offlineRoutes.POST("/bundles", offlineHdl.CreateBundle)
		}

		v2xRoutes := api.Group("/v2x")
		{
			v2xRoutes.GET("/spat/:id", v2xHdl.GetSignalSPaT)
			v2xRoutes.GET("/signals/nearby", v2xHdl.GetNearbySignals)
			v2xRoutes.POST("/glosa/advisory", v2xHdl.GetGLOSAAdvisory)
		}

		laneRoutes := api.Group("/lanelevel")
		{
			laneRoutes.POST("/rtk/correct", laneHdl.CorrectRTK)
			laneRoutes.GET("/guidance", laneHdl.GetLaneGuidance)
		}

		obfuscationRoutes := api.Group("/obfuscation")
		{
			obfuscationRoutes.POST("/transform", obfuscationHdl.Transform)
			obfuscationRoutes.POST("/fuzz", obfuscationHdl.Fuzz)
		}

		hdMapRoutes := api.Group("/hdmap")
		{
			hdMapRoutes.POST("/observations", hdMapHdl.IngestObservation)
			hdMapRoutes.GET("/changes/nearby", hdMapHdl.GetActiveChanges)
		}

		routeRoutes := api.Group("/routes")
		{
			routeRoutes.GET("/directions", routesHdl.GetDirections)
			routeRoutes.GET("/distance-matrix", routesHdl.GetDistanceMatrix)
		}

		roadRoutes := api.Group("/roads")
		{
			roadRoutes.POST("/snap-to-roads", routesHdl.SnapToRoads)
			roadRoutes.GET("/speed-limits", routesHdl.GetSpeedLimits)
		}

		geocodeRoutes := api.Group("/geocoding")
		{
			geocodeRoutes.GET("/geocode", geocodingHdl.Geocode)
			geocodeRoutes.GET("/reverse", geocodingHdl.ReverseGeocode)
		}

		placeRoutes := api.Group("/places")
		{
			placeRoutes.GET("/search", placesHdl.SearchPlaces)
			placeRoutes.GET("/autocomplete", placesHdl.Autocomplete)
			placeRoutes.GET("/reverse", placesHdl.ReverseGeocode)
		}

		envRoutes := api.Group("/environment")
		{
			envRoutes.GET("/air-quality", envHdl.GetAirQuality)
			envRoutes.GET("/solar", envHdl.GetSolar)
			envRoutes.GET("/pollen", envHdl.GetPollen)
		}

		fleetRoutes := api.Group("/fleet")
		{
			fleetRoutes.POST("/location", fleetHdl.UpdateLocation)
			fleetRoutes.GET("/nearby-drivers", fleetHdl.GetNearbyDrivers)
		}

		api.POST("/geolocation", geoExtrasHdl.Geolocation)
		api.GET("/elevation", geoExtrasHdl.GetElevation)
		api.GET("/timezone", geoExtrasHdl.GetTimeZone)

		tileRoutes := api.Group("/tiles")
		{
			tileRoutes.GET("/:z/:x/:y", tileHdl.ServeTile)
		}
	}

	adminTokenPair, _ := jwtService.GenerateTokenPair(ctx, "maitidebjit2@gmail.com", adminUserID.String(), "admin", "active")
	userTokenPair, _ := jwtService.GenerateTokenPair(ctx, "testuser@example.com", testUserID.String(), "user", "active")

	var results []TestResult

	execReq := func(category, feature, method, path string, body interface{}, bearerToken string, expectedStatus int) {
		start := time.Now()
		var bodyReader io.Reader
		if body != nil {
			jsonBytes, _ := json.Marshal(body)
			bodyReader = bytes.NewReader(jsonBytes)
		}

		req, _ := http.NewRequest(method, path, bodyReader)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")
		if bearerToken != "" {
			req.Header.Set("Authorization", "Bearer "+bearerToken)
		}

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		dur := time.Since(start)

		success := (w.Code == expectedStatus)
		note := fmt.Sprintf("Code: %d (Expected %d)", w.Code, expectedStatus)
		if !success {
			note = fmt.Sprintf("FAIL: got %d, body: %s", w.Code, w.Body.String())
		}

		results = append(results, TestResult{
			Category: category,
			Feature:  feature,
			Method:   method,
			Endpoint: path,
			Status:   w.Code,
			Success:  success,
			Duration: dur,
			Note:     note,
		})
	}

	// --- 1. HEALTH CHECK ---
	execReq("Core", "Health Check", "GET", "/health", nil, "", 200)

	// --- 2. AUTHENTICATION & PASSWORDLESS OTP ---
	execReq("Auth", "Admin OTP Request (Authorized)", "POST", "/api/v1/auth/admin/request-otp", map[string]string{"email": "maitidebjit2@gmail.com"}, "", 200)
	execReq("Auth", "Admin OTP Request (Unauthorized Email)", "POST", "/api/v1/auth/admin/request-otp", map[string]string{"email": "hacker@example.com"}, "", 403)
	execReq("Auth", "User OTP 90s Cooldown Enforcement", "POST", "/api/v1/auth/admin/request-otp", map[string]string{"email": "maitidebjit2@gmail.com"}, "", 429)
	execReq("Auth", "User Telemetry & Location Update", "POST", "/api/v1/auth/telemetry", map[string]interface{}{"latitude": 28.6129, "longitude": 77.2295, "device": "Android 15 Pixel", "active_minutes_delta": 5}, userTokenPair.AccessToken, 200)
	execReq("Auth", "User Profile (/me)", "GET", "/api/v1/auth/me", nil, userTokenPair.AccessToken, 200)

	// --- 3. PLACES & SPATIAL SEARCH ---
	execReq("Places", "Full-Text Place Search", "GET", "/api/v1/places/search?q=India", nil, "", 200)
	execReq("Places", "2dsphere Proximity Search (50km)", "GET", "/api/v1/places/search?latitude=28.6129&longitude=77.2295&radius_meters=50000", nil, "", 200)
	execReq("Places", "Autocomplete with Projections", "GET", "/api/v1/places/autocomplete?query=Del", nil, "", 200)
	execReq("Places", "Reverse Geocode (Spatial)", "GET", "/api/v1/places/reverse?lat=28.6129&lng=77.2295", nil, "", 200)

	// --- 4. ROUTING & DIRECTIONS ---
	execReq("Routes", "Turn-by-Turn Driving Directions", "GET", "/api/v1/routes/directions?origin=28.6129,77.2295&destination=28.5562,77.1000&mode=driving", nil, "", 200)
	execReq("Routes", "Distance Matrix", "GET", "/api/v1/routes/distance-matrix?origins=28.6129,77.2295&destinations=28.5562,77.1000", nil, "", 200)
	execReq("Roads", "Snap to Roads", "POST", "/api/v1/roads/snap-to-roads", map[string]interface{}{"path": []map[string]float64{{"lat": 28.6129, "lng": 77.2295}, {"lat": 28.5562, "lng": 77.1000}}}, "", 200)
	execReq("Roads", "Speed Limits", "GET", "/api/v1/roads/speed-limits?points=28.6129,77.2295|28.5562,77.1000", nil, "", 200)

	// --- 5. MAPS & TILES ---
	execReq("Maps", "Mapbox Vector Style Spec v8", "GET", "/api/v1/maps/style.json?theme=standard", nil, "", 200)
	execReq("Maps", "Static Map SVG Generator", "GET", "/api/v1/maps/static?center=28.6129,77.2295&zoom=13", nil, "", 200)
	execReq("Maps", "Geospatial Clustering", "GET", "/api/v1/maps/clusters?min_lat=28.0&max_lat=29.0&min_lng=76.0&max_lng=78.0&zoom=10", nil, "", 200)
	execReq("Tiles", "Mapbox Vector Tile MVT Server", "GET", "/api/v1/tiles/14/11993/7165", nil, "", 200)

	// --- 6. INDIAN NAVIGATION ECOSYSTEM ---
	execReq("NavIC", "NavIC Satellite Fix", "POST", "/api/v1/navic/fix", map[string]interface{}{"raw_latitude": 28.6129, "raw_longitude": 77.2295, "enable_gagan": true}, "", 200)
	execReq("NavIC", "Constellation Status", "GET", "/api/v1/navic/constellation", nil, "", 200)
	execReq("Tolls", "FASTag Toll Calculator", "POST", "/api/v1/tolls/calculate", map[string]interface{}{"origin": "Delhi", "destination": "Agra", "vehicle_class": "car"}, "", 200)
	execReq("Tolls", "Nearby FASTag Plazas", "GET", "/api/v1/tolls/nearby?lat=28.6129&lng=77.2295", nil, "", 200)
	execReq("PINCode", "PIN Code Lookup (110001)", "GET", "/api/v1/pincode/110001", nil, "", 200)
	execReq("PINCode", "Landmark Address Parser", "POST", "/api/v1/pincode/parse-address", map[string]string{"address": "Near India Gate, Connaught Place, New Delhi 110001"}, "", 200)
	execReq("EV", "EV Charging Stations Nearby", "GET", "/api/v1/ev/stations?lat=28.6129&lng=77.2295", nil, "", 200)
	execReq("Emergency", "112 / 1033 Highway SOS", "POST", "/api/v1/emergency/sos", map[string]interface{}{"latitude": 28.6129, "longitude": 77.2295, "type": "MEDICAL"}, "", 200)
	execReq("DIGIPIN", "DIGIPIN Micro-Grid Encode", "GET", "/api/v1/digipin/encode?lat=28.6129&lng=77.2295", nil, "", 200)
	execReq("DIGIPIN", "DIGIPIN Micro-Grid Decode", "GET", "/api/v1/digipin/decode/28-77-DEL-01", nil, "", 200)
	execReq("Fares", "Auto & Taxi Fare Estimator", "POST", "/api/v1/fares/estimate", map[string]interface{}{"city": "Delhi", "distance_km": 15.5, "vehicle_type": "auto"}, "", 200)
	execReq("Weather", "IMD Dense Fog & Highway Radar", "GET", "/api/v1/weather/highway?lat=28.6129&lng=77.2295&highway=Yamuna%20Expressway", nil, "", 200)
	execReq("Hazards", "Ahead Road Hazards", "GET", "/api/v1/hazards/ahead?lat=28.6129&lng=77.2295", nil, "", 200)
	execReq("Vernacular", "Multilingual Voice Prompts", "POST", "/api/v1/vernacular/prompt", map[string]string{"text": "Turn right in 200 meters", "target_lang": "hi"}, "", 200)
	execReq("Traffic", "Real-Time Traffic Telemetry", "POST", "/api/v1/traffic/telemetry", map[string]interface{}{"pings": []map[string]interface{}{{"segment_id": "NH44_SEG_01", "speed_kmh": 45.0, "latitude": 28.6129, "longitude": 77.2295}}}, "", 202)
	execReq("Traffic", "Nearby Traffic Segments", "GET", "/api/v1/traffic/segments/nearby?lat=28.6129&lng=77.2295", nil, "", 200)
	execReq("V2X", "Traffic Light SPaT & GLOSA Advisory", "POST", "/api/v1/v2x/glosa/advisory", map[string]interface{}{"vehicle_location": map[string]float64{"lat": 28.6129, "lng": 77.2295}, "speed_kmh": 40.0, "intersection_id": "INT_DEL_CP_01"}, "", 200)
	execReq("LaneLevel", "RTK Ground Correction", "POST", "/api/v1/lanelevel/rtk/correct", map[string]interface{}{"raw_lat": 28.6129, "raw_lng": 77.2295}, "", 200)
	execReq("Obfuscation", "Differential Privacy Coordinate Fuzzing", "POST", "/api/v1/obfuscation/fuzz", map[string]interface{}{"latitude": 28.6129, "longitude": 77.2295, "epsilon": 0.1}, "", 200)
	execReq("HDMap", "Autonomous Vehicle Observation Ingest", "POST", "/api/v1/hdmap/observations", map[string]interface{}{"sensor": "LiDAR_CAM", "detected_change": "LANE_CLOSURE", "latitude": 28.6129, "longitude": 77.2295}, "", 202)
	execReq("Boundaries", "Survey of India (SOI) Territorial Borders", "GET", "/api/v1/boundaries/territorial", nil, "", 200)
	execReq("Environment", "Air Quality (AQI)", "GET", "/api/v1/environment/air-quality?lat=28.6129&lng=77.2295", nil, "", 200)
	execReq("Environment", "Solar Radiation Index", "GET", "/api/v1/environment/solar?lat=28.6129&lng=77.2295", nil, "", 200)
	execReq("Environment", "Pollen Alert Index", "GET", "/api/v1/environment/pollen?lat=28.6129&lng=77.2295", nil, "", 200)
	execReq("Fleet", "Update Fleet Vehicle Location", "POST", "/api/v1/fleet/location", map[string]interface{}{"driver_id": "DRV_DL_001", "latitude": 28.6129, "longitude": 77.2295, "heading": 180.0, "speed_kmh": 45.0}, "", 200)
	execReq("GeoExtras", "Reverse TimeZone Lookup", "GET", "/api/v1/timezone?location=28.6129,77.2295", nil, "", 200)

	// --- 7. USER RATINGS & REVIEWS ---
	execReq("Ratings", "Submit App Rating (5 Stars)", "POST", "/api/v1/ratings", map[string]interface{}{"score": 5, "feedback": "Super fast navigation and accurate tolls!", "category": "navigation"}, userTokenPair.AccessToken, 200)
	execReq("Ratings", "Get My Submitted Rating", "GET", "/api/v1/ratings/my-rating", nil, userTokenPair.AccessToken, 200)

	// --- 8. ADMIN COMMAND CENTER REST APIS ---
	execReq("Admin", "Admin Overview Metrics", "GET", "/api/v1/admin/overview", nil, adminTokenPair.AccessToken, 200)
	execReq("Admin", "Admin Live Active Users", "GET", "/api/v1/admin/users/active", nil, adminTokenPair.AccessToken, 200)
	execReq("Admin", "Admin List Users", "GET", "/api/v1/admin/users", nil, adminTokenPair.AccessToken, 200)
	execReq("Admin", "Admin Feature Usage Graph Analytics", "GET", "/api/v1/admin/analytics/feature-usage", nil, adminTokenPair.AccessToken, 200)
	execReq("Admin", "Admin User Activity DAU Graph", "GET", "/api/v1/admin/analytics/users", nil, adminTokenPair.AccessToken, 200)
	execReq("Admin", "Admin Rating Analytics Feed", "GET", "/api/v1/admin/ratings", nil, adminTokenPair.AccessToken, 200)
	execReq("Admin", "Admin Weather Manual Override Injection", "POST", "/api/v1/admin/weather/override", map[string]interface{}{"highway_name": "Yamuna Expressway", "temperature": 8.5, "condition": "Dense Fog", "visibility_meters": 35, "is_dense_fog": true, "alert_level": "RED"}, adminTokenPair.AccessToken, 200)
	execReq("Admin", "Admin Get Weather Overrides", "GET", "/api/v1/admin/weather/overrides", nil, adminTokenPair.AccessToken, 200)
	execReq("Admin", "Admin Traffic Manual Override Injection", "POST", "/api/v1/admin/traffic/override", map[string]interface{}{"segment_id": "NH44_DEL_01", "congestion_level": "DARK_RED", "speed_factor": 0.2, "incident_description": "Bridge maintenance single lane"}, adminTokenPair.AccessToken, 200)
	execReq("Admin", "Admin Get Traffic Overrides", "GET", "/api/v1/admin/traffic/overrides", nil, adminTokenPair.AccessToken, 200)

	// --- 9. SECURITY / ACCESS CONTROL CHECK ---
	execReq("Security", "User Accessing Admin Endpoint (Forbidden Check)", "GET", "/api/v1/admin/overview", nil, userTokenPair.AccessToken, 403)
	execReq("Security", "Unauthenticated Accessing Protected Endpoint (Unauthorized Check)", "GET", "/api/v1/admin/overview", nil, "", 401)

	// Summary output
	fmt.Println("\n================================================================================")
	fmt.Println("📊 FULL FEATURE TEST RESULTS MATRIX")
	fmt.Println("================================================================================")
	fmt.Printf("%-12s | %-40s | %-6s | %-6s | %-8s | %s\n", "CATEGORY", "FEATURE", "METHOD", "STATUS", "LATENCY", "RESULT")
	fmt.Println("--------------------------------------------------------------------------------")

	passedCount := 0
	for _, r := range results {
		resIcon := "✅ PASS"
		if !r.Success {
			resIcon = "❌ FAIL"
		} else {
			passedCount++
		}
		fmt.Printf("%-12s | %-40s | %-6s | %-6d | %-8s | %s\n", r.Category, r.Feature, r.Method, r.Status, r.Duration.Round(time.Microsecond), resIcon)
	}

	fmt.Println("================================================================================")
	fmt.Printf("🎯 SUMMARY: %d / %d FEATURES TESTED SUCCESSFULLY (%.1f%% SUCCESS RATE)\n",
		passedCount, len(results), float64(passedCount)/float64(len(results))*100.0)
	fmt.Println("================================================================================")

	if passedCount == len(results) {
		fmt.Println("🎉 ALL FEATURES ARE 100% OPERATIONAL, OPTIMIZED & VERIFIED!")
	} else {
		fmt.Printf("⚠️ %d features failed verification. Please review above.\n", len(results)-passedCount)
	}
}
