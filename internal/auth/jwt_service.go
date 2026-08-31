package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// In a real application, NEVER hardcode this. Load it from your .env file!
var jwtSecretKey = []byte("super_secret_bmap_key_change_me_in_production")

// CustomClaims defines the payload of our JWT
type CustomClaims struct {
	Email  string `json:"email"`
	UserID string `json:"user_id"` // You would populate this from PostgreSQL
	jwt.RegisteredClaims
}

// JWTService handles JWT operations
type JWTService struct{}

func NewJWTService() *JWTService {
	return &JWTService{}
}

// GenerateToken creates a new JWT for an authenticated user
func (s *JWTService) GenerateToken(email, userID string) (string, error) {
	// Set custom claims
	claims := CustomClaims{
		Email:  email,
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			// Token expires in 24 hours
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "bmap_auth_service",
		},
	}

	// Create token with HMAC SHA256 signing method
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign the token with our secret string
	signedToken, err := token.SignedString(jwtSecretKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return signedToken, nil
}
