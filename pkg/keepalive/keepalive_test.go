package keepalive_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/pkg/keepalive"
)

func TestKeepAliveWorker_PingOnce(t *testing.T) {
	// Create a mock health server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"healthy"}`))
	}))
	defer ts.Close()

	cfg := &config.KeepAliveConfig{
		Enabled:         true,
		IntervalMinutes: 2,
		TargetURL:       ts.URL,
	}

	worker := keepalive.NewWorker(cfg)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := worker.PingOnce(ctx, ts.URL)
	if err != nil {
		t.Fatalf("expected nil error on keep-alive self-ping, got %v", err)
	}
}
