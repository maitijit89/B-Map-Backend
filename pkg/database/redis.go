package database

import (
	"context"
	"crypto/tls"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

func InitRedis() *redis.Client {
	var options *redis.Options
	var err error

	redisURL := os.Getenv("REDIS_URL")
	if redisURL != "" {
		// Use URL if provided (handles TLS/rediss automatically)
		options, err = redis.ParseURL(redisURL)
		if err != nil {
			fmt.Printf("Warning: Failed to parse REDIS_URL: %v\n", err)
		}
	}

	if options == nil {
		// Fallback to individual fields
		options = &redis.Options{
			Addr:     fmt.Sprintf("%s:%s", os.Getenv("REDIS_HOST"), os.Getenv("REDIS_PORT")),
			Password: os.Getenv("REDIS_PASSWORD"),
			DB:       0,
		}
		// If using Upstash without a URL, you might need to enable TLS manually
		if os.Getenv("ENV") == "production" {
			options.TLSConfig = &tls.Config{
				InsecureSkipVerify: true,
			}
		}
	}

	rdb := redis.NewClient(options)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = rdb.Ping(ctx).Result()
	if err != nil {
		fmt.Printf("Warning: Failed to connect to Redis: %v\n", err)
	}

	return rdb
}
