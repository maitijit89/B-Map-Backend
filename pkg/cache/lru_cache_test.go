package cache_test

import (
	"testing"
	"time"

	"github.com/maitijit89/b-map-backend/pkg/cache"
)

func TestLRUCache_BasicOperations(t *testing.T) {
	c := cache.NewLRUCache(3, 5*time.Second)

	c.Set("k1", "val1")
	c.Set("k2", "val2")
	c.Set("k3", "val3")

	if val, ok := c.Get("k1"); !ok || val != "val1" {
		t.Fatalf("expected val1, got %v", val)
	}

	// Insert 4th item, should evict k2 (since k1 was accessed)
	c.Set("k4", "val4")

	if _, ok := c.Get("k2"); ok {
		t.Error("expected k2 to be evicted")
	}

	if val, ok := c.Get("k4"); !ok || val != "val4" {
		t.Fatalf("expected val4, got %v", val)
	}

	hits, misses, size := c.Stats()
	if size != 3 {
		t.Errorf("expected cache size 3, got %d", size)
	}
	if hits < 2 || misses < 1 {
		t.Errorf("unexpected stats: hits=%d, misses=%d", hits, misses)
	}
}

func TestLRUCache_TTLExpiration(t *testing.T) {
	c := cache.NewLRUCache(10, 50*time.Millisecond)

	c.Set("temp", "data")
	if _, ok := c.Get("temp"); !ok {
		t.Fatal("expected temp key to exist immediately")
	}

	time.Sleep(70 * time.Millisecond)

	if _, ok := c.Get("temp"); ok {
		t.Error("expected temp key to have expired")
	}
}
