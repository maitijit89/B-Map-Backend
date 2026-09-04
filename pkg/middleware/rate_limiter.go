package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type tokenBucket struct {
	tokens         float64
	capacity       float64
	refillRate     float64 // tokens per second
	lastRefillTime time.Time
}

const numShards = 32

type shard struct {
	mu      sync.Mutex
	buckets map[string]*tokenBucket
}

type RateLimiter struct {
	shards     [numShards]shard
	capacity   float64
	refillRate float64
	stopChan   chan struct{}
	stopped    sync.Once
}

func fnv32(key string) uint32 {
	hash := uint32(2166136261)
	const prime32 = uint32(16777619)
	for i := 0; i < len(key); i++ {
		hash ^= uint32(key[i])
		hash *= prime32
	}
	return hash
}

func (rl *RateLimiter) getShard(key string) *shard {
	return &rl.shards[fnv32(key)%numShards]
}

func NewRateLimiter(ratePerSecond float64, burstCapacity int) *RateLimiter {
	rl := &RateLimiter{
		capacity:   float64(burstCapacity),
		refillRate: ratePerSecond,
		stopChan:   make(chan struct{}),
	}
	for i := 0; i < numShards; i++ {
		rl.shards[i].buckets = make(map[string]*tokenBucket)
	}

	// Periodically cleanup stale buckets
	go rl.cleanupRoutine()
	return rl
}

func (rl *RateLimiter) Allow(key string) bool {
	return rl.allow(key)
}

func (rl *RateLimiter) allow(key string) bool {
	s := rl.getShard(key)
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	b, exists := s.buckets[key]
	if !exists {
		b = &tokenBucket{
			tokens:         rl.capacity - 1,
			capacity:       rl.capacity,
			refillRate:     rl.refillRate,
			lastRefillTime: now,
		}
		s.buckets[key] = b
		return true
	}

	// Refill tokens based on elapsed time
	elapsed := now.Sub(b.lastRefillTime).Seconds()
	b.tokens = b.tokens + elapsed*b.refillRate
	if b.tokens > b.capacity {
		b.tokens = b.capacity
	}
	b.lastRefillTime = now

	if b.tokens >= 1.0 {
		b.tokens -= 1.0
		return true
	}

	return false
}

func (rl *RateLimiter) cleanupRoutine() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-rl.stopChan:
			return
		case <-ticker.C:
			cutoff := time.Now().Add(-15 * time.Minute)
			for i := 0; i < numShards; i++ {
				s := &rl.shards[i]
				s.mu.Lock()
				for k, b := range s.buckets {
					if b.lastRefillTime.Before(cutoff) {
						delete(s.buckets, k)
					}
				}
				s.mu.Unlock()
			}
		}
	}
}

// Stop terminates the background cleanup goroutine gracefully.
func (rl *RateLimiter) Stop() {
	rl.stopped.Do(func() {
		close(rl.stopChan)
	})
}

// RateLimitMiddleware returns a Gin middleware enforcing token bucket rate limits per client IP.
func RateLimitMiddleware(ratePerSecond float64, burst int) gin.HandlerFunc {
	limiter := NewRateLimiter(ratePerSecond, burst)

	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		if !limiter.allow(clientIP) {
			c.Header("Retry-After", "1")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":   "Too Many Requests",
				"message": "Rate limit exceeded. Please throttle your API requests.",
				"status":  http.StatusTooManyRequests,
			})
			return
		}
		c.Next()
	}
}
