package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// OTPTTL defines how long the OTP is valid (5 minutes)
	OTPTTL = 5 * time.Minute
	// CooldownTTL prevents rapid resend spam (90 seconds / 1 min 30 sec)
	CooldownTTL = 90 * time.Second
	// MaxFailedAttempts before locking verification
	MaxFailedAttempts = 5
	// LockoutTTL duration after max failed attempts (15 minutes)
	LockoutTTL = 15 * time.Minute

	// Redis Key Prefixes
	PrefixOTP      = "user:otp:"
	PrefixCooldown = "user:otp:cooldown:"
	PrefixAttempts = "user:otp:attempts:"
	PrefixLockout  = "user:otp:lockout:"
)

// OTPService handles secure generation, rate-limited delivery, and brute-force protection for OTPs
type OTPService struct {
	redisClient *redis.Client
}

// NewOTPService creates a new instance of OTPService
func NewOTPService(rdb *redis.Client) *OTPService {
	return &OTPService{
		redisClient: rdb,
	}
}

// GenerateAndStoreOTP creates a cryptographically secure 6-digit OTP with anti-spam cooldown protection
func (s *OTPService) GenerateAndStoreOTP(ctx context.Context, email string) (string, error) {
	// 1. Check if email is currently locked out due to excessive failed attempts
	lockoutKey := fmt.Sprintf("%s%s", PrefixLockout, email)
	isLocked, _ := s.redisClient.Exists(ctx, lockoutKey).Result()
	if isLocked > 0 {
		return "", errors.New("too many failed verification attempts. Please wait 15 minutes before requesting a new code")
	}

	// 2. Check cooldown to prevent email flooding
	cooldownKey := fmt.Sprintf("%s%s", PrefixCooldown, email)
	inCooldown, _ := s.redisClient.Exists(ctx, cooldownKey).Result()
	if inCooldown > 0 {
		ttl, _ := s.redisClient.TTL(ctx, cooldownKey).Result()
		return "", fmt.Errorf("please wait %d seconds before requesting another code", int(ttl.Seconds()))
	}

	// 3. Generate a cryptographically secure 6-digit OTP
	otp, err := generateSecureOTP()
	if err != nil {
		return "", fmt.Errorf("failed to generate secure OTP: %w", err)
	}

	// 4. Store in Redis
	otpKey := fmt.Sprintf("%s%s", PrefixOTP, email)
	pipe := s.redisClient.Pipeline()
	pipe.Set(ctx, otpKey, otp, OTPTTL)
	pipe.Set(ctx, cooldownKey, "1", CooldownTTL)
	pipe.Del(ctx, fmt.Sprintf("%s%s", PrefixAttempts, email)) // reset failed attempt counter

	_, err = pipe.Exec(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to save OTP in cache: %w", err)
	}

	return otp, nil
}

// VerifyOTP checks the entered OTP with brute-force attempt tracking and atomic single-use invalidation
func (s *OTPService) VerifyOTP(ctx context.Context, email, enteredOTP string) (bool, error) {
	lockoutKey := fmt.Sprintf("%s%s", PrefixLockout, email)
	isLocked, _ := s.redisClient.Exists(ctx, lockoutKey).Result()
	if isLocked > 0 {
		return false, errors.New("account verification temporarily locked due to too many failed attempts. Try again later")
	}

	otpKey := fmt.Sprintf("%s%s", PrefixOTP, email)
	attemptsKey := fmt.Sprintf("%s%s", PrefixAttempts, email)

	// 1. Retrieve the stored OTP
	storedOTP, err := s.redisClient.Get(ctx, otpKey).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return false, errors.New("verification code expired or invalid. Please request a new one")
		}
		return false, fmt.Errorf("cache error: %w", err)
	}

	// 2. Validate OTP
	if storedOTP != enteredOTP {
		// Increment failed attempts counter
		attempts, _ := s.redisClient.Incr(ctx, attemptsKey).Result()
		s.redisClient.Expire(ctx, attemptsKey, OTPTTL)

		if attempts >= MaxFailedAttempts {
			s.redisClient.Set(ctx, lockoutKey, "1", LockoutTTL)
			s.redisClient.Del(ctx, otpKey)
			return false, errors.New("maximum verification attempts exceeded. Locked for 15 minutes")
		}

		remaining := MaxFailedAttempts - int(attempts)
		return false, fmt.Errorf("incorrect verification code. %d attempts remaining", remaining)
	}

	// 3. Success: Atomic deletion so OTP cannot be replayed
	pipe := s.redisClient.Pipeline()
	pipe.Del(ctx, otpKey)
	pipe.Del(ctx, attemptsKey)
	pipe.Del(ctx, fmt.Sprintf("%s%s", PrefixCooldown, email))
	_, _ = pipe.Exec(ctx)

	return true, nil
}

// generateSecureOTP creates a random 6-digit string using crypto/rand
func generateSecureOTP() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// FormatInt utility for metrics/logging
func itoa(i int) string {
	return strconv.Itoa(i)
}
