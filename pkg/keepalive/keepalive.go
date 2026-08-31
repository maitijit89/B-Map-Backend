package keepalive

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/maitijit89/b-map-backend/config"
)

// Worker handles the automated background keep-alive ping to prevent server sleeping on free-tier cloud platforms.
type Worker struct {
	cfg        *config.KeepAliveConfig
	httpClient *http.Client
	startTime  time.Time
}

// NewWorker initializes a new keep-alive heartbeat worker.
func NewWorker(cfg *config.KeepAliveConfig) *Worker {
	return &Worker{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		startTime: time.Now().UTC(),
	}
}

// Start runs the periodic health check ticker in the background.
func (w *Worker) Start(ctx context.Context) {
	if !w.cfg.Enabled {
		log.Println("[KeepAlive] Auto-ping heartbeat is disabled")
		return
	}

	interval := time.Duration(w.cfg.IntervalMinutes) * time.Minute
	if interval <= 0 {
		interval = 2 * time.Minute
	}

	targetURL := w.cfg.TargetURL
	if targetURL == "" {
		targetURL = "http://localhost:8080/health"
	}

	log.Printf("[KeepAlive] Starting automated server anti-sleep heartbeat every %v -> %s", interval, targetURL)

	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()

		// Initial warm-up ping after 10 seconds
		time.Sleep(10 * time.Second)
		w.ping(ctx, targetURL)

		for {
			select {
			case <-ctx.Done():
				log.Println("[KeepAlive] Shutting down keep-alive heartbeat worker")
				return
			case <-ticker.C:
				w.ping(ctx, targetURL)
			}
		}
	}()
}

func (w *Worker) ping(ctx context.Context, url string) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		log.Printf("[KeepAlive] Error creating health check request: %v", err)
		return
	}

	req.Header.Set("User-Agent", "B-Map-KeepAlive-Heartbeat/1.0")

	start := time.Now()
	resp, err := w.httpClient.Do(req)
	duration := time.Since(start)

	if err != nil {
		log.Printf("[KeepAlive ⚠️] Self-ping failed (%v): %v", duration, err)
		return
	}
	defer resp.Body.Close()

	uptime := time.Since(w.startTime).Round(time.Second)
	if resp.StatusCode == http.StatusOK {
		log.Printf("[KeepAlive 💚] Server heartbeat OK (%d %s) | Latency: %v | Uptime: %v",
			resp.StatusCode, http.StatusText(resp.StatusCode), duration.Round(time.Millisecond), uptime)
	} else {
		log.Printf("[KeepAlive ⚠️] Server responded with unexpected status: %d", resp.StatusCode)
	}
}

// PingOnce executes a single synchronous health check (useful for manual trigger/tests).
func (w *Worker) PingOnce(ctx context.Context, url string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create ping request: %w", err)
	}

	resp, err := w.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("ping failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}
