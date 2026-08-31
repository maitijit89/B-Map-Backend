package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/redis/go-redis/v9"
)

type otpRepository struct {
	client *redis.Client
}

// NewOTPRepository initializes a Redis-backed OTP repository.
func NewOTPRepository(client *redis.Client) domain.OTPRepository {
	return &otpRepository{client: client}
}

func (r *otpRepository) registerKey(email string) string {
	return fmt.Sprintf("otp:register:%s", strings.ToLower(strings.TrimSpace(email)))
}

func (r *otpRepository) loginKey(email string) string {
	return fmt.Sprintf("otp:login:%s", strings.ToLower(strings.TrimSpace(email)))
}

func (r *otpRepository) SavePendingRegistration(ctx context.Context, pending *domain.PendingRegistration, ttl time.Duration) error {
	data, err := json.Marshal(pending)
	if err != nil {
		return fmt.Errorf("failed to marshal pending registration data: %w", err)
	}

	key := r.registerKey(pending.Email)
	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *otpRepository) GetPendingRegistration(ctx context.Context, email string) (*domain.PendingRegistration, error) {
	key := r.registerKey(email)
	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, domain.ErrOTPNotFound
		}
		return nil, err
	}

	var pending domain.PendingRegistration
	if err := json.Unmarshal(data, &pending); err != nil {
		return nil, fmt.Errorf("failed to unmarshal pending registration: %w", err)
	}

	return &pending, nil
}

func (r *otpRepository) DeletePendingRegistration(ctx context.Context, email string) error {
	key := r.registerKey(email)
	return r.client.Del(ctx, key).Err()
}

func (r *otpRepository) SaveLoginOTP(ctx context.Context, email string, otp string, ttl time.Duration) error {
	key := r.loginKey(email)
	return r.client.Set(ctx, key, otp, ttl).Err()
}

func (r *otpRepository) GetLoginOTP(ctx context.Context, email string) (string, error) {
	key := r.loginKey(email)
	otp, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return "", domain.ErrOTPNotFound
		}
		return "", err
	}
	return otp, nil
}

func (r *otpRepository) DeleteLoginOTP(ctx context.Context, email string) error {
	key := r.loginKey(email)
	return r.client.Del(ctx, key).Err()
}
