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

type RateLimiter struct {
	mu         sync.Mutex
	buckets    map[string]*tokenBucket
	capacity   float64
	refillRate float64
}

func NewRateLimiter(ratePerSecond float64, burstCapacity int) *RateLimiter {
	rl := &RateLimiter{
		buckets:    make(map[string]*tokenBucket),
		capacity:   float64(burstCapacity),
		refillRate: ratePerSecond,
	}

	// Periodically cleanup stale buckets
	go rl.cleanupRoutine()
	return rl
}

func (rl *RateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	b, exists := rl.buckets[key]
	if !exists {
		b = &tokenBucket{
			tokens:         rl.capacity - 1,
			capacity:       rl.capacity,
			refillRate:     rl.refillRate,
			lastRefillTime: now,
		}
		rl.buckets[key] = b
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
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-15 * time.Minute)
		for k, b := range rl.buckets {
			if b.lastRefillTime.Before(cutoff) {
				delete(rl.buckets, k)
			}
		}
		rl.mu.Unlock()
	}
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
