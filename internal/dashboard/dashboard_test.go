package dashboard_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/internal/dashboard"
	"github.com/maitijit89/b-map-backend/internal/version"
)

func TestDashboardHandler_HTML(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	cfg := &config.Config{
		App: config.AppConfig{Name: "B-Map Test"},
	}
	versionSvc := version.NewVersionService("1.0.0", nil, nil)

	router.GET("/", dashboard.Handler(cfg, versionSvc))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "text/html; charset=utf-8" {
		t.Errorf("expected text/html, got %s", contentType)
	}
}

func TestDashboardHandler_JSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	cfg := &config.Config{
		App: config.AppConfig{Name: "B-Map Test"},
	}
	versionSvc := version.NewVersionService("1.0.0", nil, nil)

	router.GET("/", dashboard.Handler(cfg, versionSvc))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/", nil)
	req.Header.Set("Accept", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json; charset=utf-8" {
		t.Errorf("expected application/json, got %s", contentType)
	}
}
