package metrics

import (
	"fmt"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

type ServerMetrics struct {
	TotalRequests       int64
	TotalErrors         int64
	RouteCalculations   int64
	ActiveWSConnections int64
	StartTime           time.Time
}

var GlobalMetrics = &ServerMetrics{
	StartTime: time.Now(),
}

// MetricsMiddleware tracks request counts, error rates, and response durations.
func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		atomic.AddInt64(&GlobalMetrics.TotalRequests, 1)
		t0 := time.Now()

		c.Next()

		if c.Writer.Status() >= 400 {
			atomic.AddInt64(&GlobalMetrics.TotalErrors, 1)
		}

		duration := time.Since(t0)
		_ = duration
	}
}

// MetricsHandler returns structured JSON and Prometheus compatible operational health statistics.
func MetricsHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		uptime := time.Since(GlobalMetrics.StartTime).Round(time.Second)

		totalReq := atomic.LoadInt64(&GlobalMetrics.TotalRequests)
		totalErr := atomic.LoadInt64(&GlobalMetrics.TotalErrors)
		routes := atomic.LoadInt64(&GlobalMetrics.RouteCalculations)
		activeWS := atomic.LoadInt64(&GlobalMetrics.ActiveWSConnections)

		errorRate := 0.0
		if totalReq > 0 {
			errorRate = float64(totalErr) / float64(totalReq) * 100.0
		}

		if c.Query("format") == "prometheus" {
			c.Header("Content-Type", "text/plain; version=0.0.4")
			prom := fmt.Sprintf(
				"# HELP bmap_http_requests_total Total number of HTTP requests\n"+
					"# TYPE bmap_http_requests_total counter\n"+
					"bmap_http_requests_total %d\n\n"+
					"# HELP bmap_http_errors_total Total number of HTTP errors (>=400)\n"+
					"# TYPE bmap_http_errors_total counter\n"+
					"bmap_http_errors_total %d\n\n"+
					"# HELP bmap_route_calculations_total Total route calculations processed\n"+
					"# TYPE bmap_route_calculations_total counter\n"+
					"bmap_route_calculations_total %d\n\n"+
					"# HELP bmap_active_websocket_connections Active real-time connections\n"+
					"# TYPE bmap_active_websocket_connections gauge\n"+
					"bmap_active_websocket_connections %d\n",
				totalReq, totalErr, routes, activeWS,
			)
			c.String(http.StatusOK, prom)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":                      "healthy",
			"uptime":                      uptime.String(),
			"uptime_seconds":              int(uptime.Seconds()),
			"total_requests":              totalReq,
			"total_errors":                totalErr,
			"error_rate_percent":          errorRate,
			"route_calculations_executed": routes,
			"active_ws_connections":       activeWS,
		})
	}
}
