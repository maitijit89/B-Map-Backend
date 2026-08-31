package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/config"
	"github.com/redis/go-redis/v9"
)

const (
	// RefreshTokenTTL defines the lifespan of a refresh token (30 days)
	RefreshTokenTTL = 30 * 24 * time.Hour
	// PrefixRefreshToken in Redis
	PrefixRefreshToken = "auth:refresh:"
	// PrefixBlacklist in Redis for revoked JWT access tokens
	PrefixBlacklist = "auth:blacklist:"
)

// CustomClaims defines the payload of our signed JWT
type CustomClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Status string `json:"status"`
	jwt.RegisteredClaims
}

// TokenPair represents the standard OAuth2 / JWT access & refresh token response
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	ExpiresIn    int64     `json:"expires_in"` // seconds
	ExpiresAt    time.Time `json:"expires_at"`
}

// JWTService handles token generation, verification, rotation, and revocation
type JWTService struct {
	secretKey   []byte
	expiryHours time.Duration
	redisClient *redis.Client
}

// NewJWTService initializes the JWT service with application configuration and Redis
func NewJWTService(cfg *config.JWTConfig, rdb *redis.Client) *JWTService {
	secret := []byte(cfg.Secret)
	if len(secret) == 0 {
		secret = []byte("super_secret_jwt_key_b_map_2026")
	}

	expiry := time.Duration(cfg.ExpiryHours) * time.Hour
	if expiry <= 0 {
		expiry = 72 * time.Hour
	}

	return &JWTService{
		secretKey:   secret,
		expiryHours: expiry,
		redisClient: rdb,
	}
}

// GenerateTokenPair generates a new Access Token (JWT) and Refresh Token with role and status
func (s *JWTService) GenerateTokenPair(ctx context.Context, email, userID, role, status string) (*TokenPair, error) {
	if role == "" {
		role = "user"
	}
	if status == "" {
		status = "active"
	}

	now := time.Now().UTC()
	expiresAt := now.Add(s.expiryHours)
	jti := uuid.New().String()

	claims := CustomClaims{
		UserID: userID,
		Email:  email,
		Role:   role,
		Status: status,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			Subject:   userID,
			Issuer:    "B-Map-Platform",
			Audience:  jwt.ClaimStrings{"bmap-clients"},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}

	// 1. Sign Access Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessTokenString, err := token.SignedString(s.secretKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// 2. Generate Cryptographic Refresh Token
	refreshToken, err := generateRandomToken(32)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// 3. Store Refresh Token in Redis mapped to userID|email|role|status
	if s.redisClient != nil {
		refreshKey := fmt.Sprintf("%s%s", PrefixRefreshToken, refreshToken)
		refreshVal := fmt.Sprintf("%s|%s|%s|%s", userID, email, role, status)
		err = s.redisClient.Set(ctx, refreshKey, refreshVal, RefreshTokenTTL).Err()
		if err != nil {
			return nil, fmt.Errorf("failed to save refresh token in cache: %w", err)
		}
	}

	return &TokenPair{
		AccessToken:  accessTokenString,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(s.expiryHours.Seconds()),
		ExpiresAt:    expiresAt,
	}, nil
}

// ValidateAccessToken parses and validates a JWT token string
func (s *JWTService) ValidateAccessToken(ctx context.Context, tokenStr string) (*CustomClaims, error) {
	claims := &CustomClaims{}

	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing algorithm: %v", token.Header["alg"])
		}
		return s.secretKey, nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("invalid or expired token")
	}

	// Check if token has been explicitly revoked/blacklisted in Redis
	if s.redisClient != nil && claims.ID != "" {
		blacklistKey := fmt.Sprintf("%s%s", PrefixBlacklist, claims.ID)
		isBlacklisted, _ := s.redisClient.Exists(ctx, blacklistKey).Result()
		if isBlacklisted > 0 {
			return nil, errors.New("token has been revoked (logged out)")
		}
	}

	return claims, nil
}

// RefreshToken exchanges an active refresh token for a newly rotated token pair
func (s *JWTService) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	if s.redisClient == nil {
		return nil, errors.New("cache unavailable for session refresh")
	}

	refreshKey := fmt.Sprintf("%s%s", PrefixRefreshToken, refreshToken)
	val, err := s.redisClient.Get(ctx, refreshKey).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, errors.New("invalid or expired refresh token")
		}
		return nil, fmt.Errorf("cache lookup error: %w", err)
	}

	// Invalidate previous refresh token (Rotation Security)
	_ = s.redisClient.Del(ctx, refreshKey).Err()

	// Parse stored payload userID|email|role|status
	var userID, email, role, status string
	parts := splitPipe(val)
	if len(parts) >= 2 {
		userID = parts[0]
		email = parts[1]
	}
	if len(parts) >= 3 {
		role = parts[2]
	}
	if len(parts) >= 4 {
		status = parts[3]
	}

	if userID == "" || email == "" {
		return nil, errors.New("corrupted session data")
	}

	// Generate fresh token pair
	return s.GenerateTokenPair(ctx, email, userID, role, status)
}

// RevokeSession revokes a refresh token and blacklists the active JWT access token
func (s *JWTService) RevokeSession(ctx context.Context, refreshToken string, claims *CustomClaims) error {
	if s.redisClient == nil {
		return nil
	}

	pipe := s.redisClient.Pipeline()

	// Revoke refresh token
	if refreshToken != "" {
		pipe.Del(ctx, fmt.Sprintf("%s%s", PrefixRefreshToken, refreshToken))
	}

	// Blacklist JWT JTI until its natural expiry
	if claims != nil && claims.ID != "" && claims.ExpiresAt != nil {
		remaining := time.Until(claims.ExpiresAt.Time)
		if remaining > 0 {
			blacklistKey := fmt.Sprintf("%s%s", PrefixBlacklist, claims.ID)
			pipe.Set(ctx, blacklistKey, "1", remaining)
		}
	}

	_, err := pipe.Exec(ctx)
	return err
}

func generateRandomToken(n int) (string, error) {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func splitPipe(s string) []string {
	var out []string
	curr := ""
	for _, c := range s {
		if c == '|' {
			out = append(out, curr)
			curr = ""
		} else {
			curr += string(c)
		}
	}
	if curr != "" {
		out = append(out, curr)
	}
	return out
}
