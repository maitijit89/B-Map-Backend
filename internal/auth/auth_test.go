package auth_test

import (
	"context"
	"testing"
	"time"

	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/internal/auth"
	"github.com/maitijit89/b-map-backend/pkg/database"
)

func TestAuth_Lifecycle(t *testing.T) {
	cfg := config.LoadConfig()

	// Connect to live Redis / Upstash
	rdb, err := database.InitRedis(&cfg.Redis)
	if err != nil {
		t.Skipf("Skipping live Redis auth test: %v", err)
	}
	defer rdb.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	testEmail := "auth_test_user@bmap.com"
	testUserID := "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

	// Clean any previous test data
	_ = rdb.Del(ctx, "user:otp:"+testEmail).Err()
	_ = rdb.Del(ctx, "user:otp:cooldown:"+testEmail).Err()
	_ = rdb.Del(ctx, "user:otp:attempts:"+testEmail).Err()
	_ = rdb.Del(ctx, "user:otp:lockout:"+testEmail).Err()

	// 1. Initialize Services
	otpService := auth.NewOTPService(rdb)
	jwtService := auth.NewJWTService(&cfg.JWT, rdb)

	// 2. Generate OTP
	otp, err := otpService.GenerateAndStoreOTP(ctx, testEmail)
	if err != nil {
		t.Fatalf("failed to generate OTP: %v", err)
	}

	if len(otp) != 6 {
		t.Fatalf("expected 6-digit OTP, got %s", otp)
	}

	// 3. Verify Anti-Spam Cooldown (calling immediately should trigger cooldown)
	_, err = otpService.GenerateAndStoreOTP(ctx, testEmail)
	if err == nil {
		t.Fatal("expected cooldown error when requesting OTP immediately, got nil")
	}

	// 4. Verify Incorrect OTP Attempt
	valid, err := otpService.VerifyOTP(ctx, testEmail, "000000")
	if valid || err == nil {
		t.Fatal("expected failure on wrong OTP")
	}

	// 5. Verify Correct OTP
	valid, err = otpService.VerifyOTP(ctx, testEmail, otp)
	if !valid || err != nil {
		t.Fatalf("expected valid OTP verification, got %v", err)
	}

	// 6. Verify Single-Use Invalidation (re-verifying same OTP should fail)
	valid, err = otpService.VerifyOTP(ctx, testEmail, otp)
	if valid || err == nil {
		t.Fatal("expected failure on replayed single-use OTP")
	}

	// 7. Generate Dual Tokens (Access + Refresh)
	tokenPair, err := jwtService.GenerateTokenPair(ctx, testEmail, testUserID, "admin", "active")
	if err != nil {
		t.Fatalf("failed to generate token pair: %v", err)
	}

	if tokenPair.AccessToken == "" || tokenPair.RefreshToken == "" {
		t.Fatal("expected non-empty access and refresh tokens")
	}

	// 8. Validate Access Token Claims
	claims, err := jwtService.ValidateAccessToken(ctx, tokenPair.AccessToken)
	if err != nil {
		t.Fatalf("failed to validate access token: %v", err)
	}

	if claims.Email != testEmail || claims.UserID != testUserID {
		t.Errorf("claims mismatch: email=%s, userID=%s", claims.Email, claims.UserID)
	}

	// 9. Rotate Refresh Token
	rotatedTokens, err := jwtService.RefreshToken(ctx, tokenPair.RefreshToken)
	if err != nil {
		t.Fatalf("failed to rotate refresh token: %v", err)
	}

	if rotatedTokens.AccessToken == "" || rotatedTokens.RefreshToken == tokenPair.RefreshToken {
		t.Fatal("expected newly rotated refresh token")
	}

	// 10. Revoke Session (Logout)
	err = jwtService.RevokeSession(ctx, rotatedTokens.RefreshToken, claims)
	if err != nil {
		t.Fatalf("failed to revoke session: %v", err)
	}

	// 11. Verify Revoked Token is Blacklisted
	_, err = jwtService.ValidateAccessToken(ctx, tokenPair.AccessToken)
	if err == nil {
		t.Fatal("expected revoked access token to be rejected by blacklist check")
	}
}
