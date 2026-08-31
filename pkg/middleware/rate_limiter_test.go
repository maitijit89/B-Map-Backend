package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/maitijit89/b-map-backend/pkg/middleware"
)

func TestRateLimiter_Throttle(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// 2 requests burst, 1 req/sec refill
	router.Use(middleware.RateLimitMiddleware(1.0, 2))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "OK")
	})

	// 1st request should pass
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", w1.Code)
	}

	// 2nd request should pass (burst)
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", w2.Code)
	}

	// 3rd request should be rate limited (429)
	w3 := httptest.NewRecorder()
	req3, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w3, req3)
	if w3.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429 Too Many Requests, got %d", w3.Code)
	}
}
