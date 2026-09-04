package server_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

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
	"github.com/maitijit89/b-map-backend/internal/roadhazards"
	"github.com/maitijit89/b-map-backend/internal/routes"
	"github.com/maitijit89/b-map-backend/internal/server"
	"github.com/maitijit89/b-map-backend/internal/tiles"
	"github.com/maitijit89/b-map-backend/internal/toll"
	"github.com/maitijit89/b-map-backend/internal/traffic"
	"github.com/maitijit89/b-map-backend/internal/v2x"
	"github.com/maitijit89/b-map-backend/internal/vernacular"
	"github.com/maitijit89/b-map-backend/internal/version"
	"github.com/maitijit89/b-map-backend/internal/weather"
)

func TestSetupRouter_HealthAndMetrics(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{
		App: config.AppConfig{Name: "B-Map Router Test", Port: "8080", Version: "1.0.0"},
	}

	analyticsSvc := analytics.NewAnalyticsService(nil, nil)
	versionSvc := version.NewVersionService("1.0.0", nil, nil)
	weatherSvc := weather.NewWeatherService()
	trafficSvc := traffic.NewTrafficService()
	ratingSvc := rating.NewRatingService(nil)
	adminSvc := admin.NewAdminService(nil, ratingSvc, analyticsSvc, weatherSvc, trafficSvc)

	dummyAuthMiddleware := func(c *gin.Context) { c.Next() }

	router := server.SetupRouter(server.RouterConfig{
		Config:           cfg,
		AuthMiddleware:   dummyAuthMiddleware,
		AnalyticsService: analyticsSvc,
		VersionService:   versionSvc,
		AuthHdl:          auth.NewAuthHandler(nil, nil, nil, nil),
		AdminHdl:         admin.NewHandler(adminSvc, analyticsSvc, weatherSvc, trafficSvc, ratingSvc),
		RatingHdl:        rating.NewHandler(ratingSvc, nil),
		MapsHdl:          maps.NewHandler(nil, cfg),
		BoundaryHdl:      boundaries.NewHandler(boundaries.NewBoundaryService(nil)),
		NavICHdl:         navic.NewHandler(navic.NewNavICService()),
		TollHdl:          toll.NewHandler(toll.NewTollService()),
		PINCodeHdl:       pincode.NewHandler(pincode.NewPINCodeService()),
		EVHdl:            evcharging.NewHandler(evcharging.NewEVService()),
		EmergencyHdl:     emergency.NewHandler(emergency.NewEmergencyService()),
		DIGIPINHdl:       digipin.NewHandler(digipin.NewDIGIPINService()),
		FareHdl:          fare.NewHandler(fare.NewFareService()),
		WeatherHdl:       weather.NewHandler(weatherSvc),
		HazardHdl:        roadhazards.NewHandler(roadhazards.NewHazardService()),
		VernacularHdl:    vernacular.NewHandler(vernacular.NewVernacularService()),
		TrafficHdl:       traffic.NewHandler(trafficSvc),
		OfflineHdl:       offline.NewHandler(offline.NewOfflineService(nil)),
		V2XHdl:           v2x.NewHandler(v2x.NewV2XService()),
		LaneHdl:          lanelevel.NewHandler(lanelevel.NewLaneLevelService()),
		ObfuscationHdl:   obfuscation.NewHandler(obfuscation.NewObfuscationService()),
		HDMapHdl:         hdmap.NewHandler(hdmap.NewHDMapService()),
		RoutesHdl:        routes.NewHandler(routes.NewRoutesEngine(nil)),
		GeocodingHdl:     geocoding.NewHandler(geocoding.NewGeocodingService(nil)),
		GeoExtrasHdl:     geoextras.NewHandler(geoextras.NewGeoExtrasService()),
		PlacesHdl:        places.NewHandler(places.NewPlacesService(nil)),
		EnvHdl:           environment.NewHandler(environment.NewEnvironmentService()),
		FleetHdl:         fleet.NewHandler(fleet.NewFleetService(nil, nil, nil, nil), nil),
		TileHdl:          tiles.NewHandler(tiles.NewTileService(nil, nil)),
		VersionHdl:       version.NewHandler(versionSvc),
	})

	// Test GET /health
	wHealth := httptest.NewRecorder()
	reqHealth, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(wHealth, reqHealth)

	if wHealth.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /health, got %d", wHealth.Code)
	}

	// Test GET /favicon.ico
	wFav := httptest.NewRecorder()
	reqFav, _ := http.NewRequest("GET", "/favicon.ico", nil)
	router.ServeHTTP(wFav, reqFav)

	if wFav.Code != http.StatusNoContent {
		t.Errorf("expected 204 No Content for /favicon.ico, got %d", wFav.Code)
	}

	// Test GET /api/v1/metrics
	wMetrics := httptest.NewRecorder()
	reqMetrics, _ := http.NewRequest("GET", "/api/v1/metrics", nil)
	router.ServeHTTP(wMetrics, reqMetrics)

	if wMetrics.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /api/v1/metrics, got %d", wMetrics.Code)
	}
}
