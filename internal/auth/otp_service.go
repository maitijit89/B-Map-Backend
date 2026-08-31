package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// OTPTTL defines how long the OTP is valid
	OTPTTL = 5 * time.Minute
	// RedisKeyPrefix ensures OTP keys don't collide with other Redis data
	RedisKeyPrefix = "user:otp:"
)

// OTPService handles the logic for OTP generation and validation
type OTPService struct {
	redisClient *redis.Client
}

// NewOTPService creates a new instance of the OTPService
func NewOTPService(rdb *redis.Client) *OTPService {
	return &OTPService{
		redisClient: rdb,
	}
}

// GenerateAndStoreOTP generates a 6-digit OTP and stores it in Redis
func (s *OTPService) GenerateAndStoreOTP(ctx context.Context, email string) (string, error) {
	// 1. Generate a cryptographically secure 6-digit OTP
	otp, err := generateSecureOTP()
	if err != nil {
		return "", fmt.Errorf("failed to generate OTP: %w", err)
	}

	// 2. Create the Redis key (e.g., "user:otp:test@example.com")
	key := fmt.Sprintf("%s%s", RedisKeyPrefix, email)

	// 3. Store in Redis with TTL
	err = s.redisClient.Set(ctx, key, otp, OTPTTL).Err()
	if err != nil {
		return "", fmt.Errorf("failed to store OTP in Redis: %w", err)
	}

	// In a real application, you would trigger your email service here to send the OTP.
	// e.g., emailClient.Send(email, "Your B Map Login Code is: "+otp)

	return otp, nil
}

// VerifyOTP checks if the provided OTP matches the one in Redis
func (s *OTPService) VerifyOTP(ctx context.Context, email, enteredOTP string) (bool, error) {
	key := fmt.Sprintf("%s%s", RedisKeyPrefix, email)

	// 1. Retrieve the stored OTP from Redis
	storedOTP, err := s.redisClient.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			// Key does not exist or has expired
			return false, errors.New("OTP expired or invalid")
		}
		return false, fmt.Errorf("redis error: %w", err)
	}

	// 2. Compare the entered OTP with the stored OTP
	if storedOTP != enteredOTP {
		return false, errors.New("incorrect OTP")
	}

	// 3. If successful, delete the OTP so it cannot be reused (Security Best Practice)
	err = s.redisClient.Del(ctx, key).Err()
	if err != nil {
		// Log this error, though the OTP is already verified.
		fmt.Printf("Warning: failed to delete OTP key for %s: %v\n", email, err)
	}

	return true, nil
}

// generateSecureOTP creates a random 6-digit string using crypto/rand
func generateSecureOTP() (string, error) {
	// Range: 0 to 999999
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	// Format as a 6-digit string with leading zeros if necessary
	return fmt.Sprintf("%06d", n.Int64()), nil
}
