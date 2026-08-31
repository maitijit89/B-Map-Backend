package domain

import (
	"context"
	"time"
)

// RegisterRequest represents the payload for user registration.
type RegisterRequest struct {
	Name  string `json:"name" validate:"required,min=2,max=100"`
	Age   int    `json:"age" validate:"required,min=13,max=120"`
	Email string `json:"email" validate:"required,email"`
}

// LoginRequest represents the payload for user login.
type LoginRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// VerifyOTPRequest represents the OTP verification payload.
type VerifyOTPRequest struct {
	Email   string `json:"email" validate:"required,email"`
	OTP     string `json:"otp" validate:"required,len=6,numeric"`
	Purpose string `json:"purpose,omitempty" validate:"omitempty,oneof=register login"`
}

// AuthResponse returns the session token and user profile on successful authentication.
type AuthResponse struct {
	Token     string        `json:"token"`
	TokenType string        `json:"token_type"`
	ExpiresIn int           `json:"expires_in"` // in seconds
	User      *UserResponse `json:"user"`
}

// PendingRegistration holds temp registration data saved in Redis before OTP confirmation.
type PendingRegistration struct {
	Name      string    `json:"name"`
	Age       int       `json:"age"`
	Email     string    `json:"email"`
	OTP       string    `json:"otp"`
	CreatedAt time.Time `json:"created_at"`
}

// OTPRepository defines the Redis caching operations for OTP lifecycle management.
type OTPRepository interface {
	SavePendingRegistration(ctx context.Context, pending *PendingRegistration, ttl time.Duration) error
	GetPendingRegistration(ctx context.Context, email string) (*PendingRegistration, error)
	DeletePendingRegistration(ctx context.Context, email string) error

	SaveLoginOTP(ctx context.Context, email string, otp string, ttl time.Duration) error
	GetLoginOTP(ctx context.Context, email string) (string, error)
	DeleteLoginOTP(ctx context.Context, email string) error
}

// AuthService defines the business logic operations for authentication.
type AuthService interface {
	Register(ctx context.Context, req *RegisterRequest) error
	Login(ctx context.Context, req *LoginRequest) error
	VerifyOTP(ctx context.Context, req *VerifyOTPRequest) (*AuthResponse, error)
}
