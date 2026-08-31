package database

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"
	"time"

	"github.com/maitijit89/b-map-backend/config"
	"github.com/redis/go-redis/v9"
)

// InitRedis connects to Redis supporting both standard TCP and TLS/rediss:// cloud endpoints (such as Upstash).
func InitRedis(cfg *config.RedisConfig) (*redis.Client, error) {
	var opts *redis.Options
	var err error

	if cfg.URL != "" {
		opts, err = redis.ParseURL(cfg.URL)
		if err != nil {
			return nil, fmt.Errorf("failed to parse REDIS_URL: %w", err)
		}
	} else {
		opts = &redis.Options{
			Addr:     fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
			Password: cfg.Password,
			DB:       cfg.DB,
		}

		// Enable TLS if connecting to cloud provider (Upstash, AWS ElastiCache, etc.)
		if strings.Contains(cfg.Host, "upstash.io") || strings.Contains(cfg.Host, "redislabs.com") {
			opts.TLSConfig = &tls.Config{
				ServerName: cfg.Host,
			}
		}
	}

	opts.DialTimeout = 5 * time.Second
	opts.ReadTimeout = 3 * time.Second
	opts.WriteTimeout = 3 * time.Second
	opts.PoolSize = 100
	opts.MinIdleConns = 10
	opts.MaxRetries = 3
	opts.PoolTimeout = 4 * time.Second

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return client, nil
}
