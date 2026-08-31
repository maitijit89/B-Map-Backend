package database_test

import (
	"context"
	"testing"
	"time"

	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/pkg/database"
)

func TestInitRedis_UpstashConnection(t *testing.T) {
	cfg := config.LoadConfig()

	client, err := database.InitRedis(&cfg.Redis)
	if err != nil {
		t.Fatalf("failed to connect to Upstash Redis: %v", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Test Set and Get on live Upstash cluster
	testKey := "bmap:test:connectivity"
	testVal := "ok_2026"

	err = client.Set(ctx, testKey, testVal, 10*time.Second).Err()
	if err != nil {
		t.Fatalf("failed to write to Redis: %v", err)
	}

	val, err := client.Get(ctx, testKey).Result()
	if err != nil {
		t.Fatalf("failed to read from Redis: %v", err)
	}

	if val != testVal {
		t.Errorf("expected %s, got %s", testVal, val)
	}

	_ = client.Del(ctx, testKey)
}
