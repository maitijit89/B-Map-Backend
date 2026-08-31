package utils_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

func TestJWT_GenerateAndValidate(t *testing.T) {
	secret := "test_secret_b_map_key"
	userID := uuid.New()
	email := "alex@example.com"

	token, err := utils.GenerateJWT(userID, email, secret, 24)
	if err != nil {
		t.Fatalf("failed to generate JWT: %v", err)
	}

	if token == "" {
		t.Fatal("expected non-empty JWT token string")
	}

	claims, err := utils.ValidateJWT(token, secret)
	if err != nil {
		t.Fatalf("failed to validate JWT: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("expected userID %s, got %s", userID, claims.UserID)
	}

	if claims.Email != email {
		t.Errorf("expected email %s, got %s", email, claims.Email)
	}
}

func TestJWT_InvalidSecret(t *testing.T) {
	userID := uuid.New()
	email := "test@example.com"

	token, err := utils.GenerateJWT(userID, email, "correct_secret", 24)
	if err != nil {
		t.Fatalf("failed to generate JWT: %v", err)
	}

	_, err = utils.ValidateJWT(token, "wrong_secret")
	if err == nil {
		t.Fatal("expected validation error with wrong secret, got nil")
	}
}
