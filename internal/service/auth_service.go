package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/maitijit89/b-map-backend/config"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/utils"
)

type authService struct {
	userRepo domain.UserRepository
	otpRepo  domain.OTPRepository
	cfg      *config.Config
}

// NewAuthService creates a new instance of domain.AuthService.
func NewAuthService(userRepo domain.UserRepository, otpRepo domain.OTPRepository, cfg *config.Config) domain.AuthService {
	return &authService{
		userRepo: userRepo,
		otpRepo:  otpRepo,
		cfg:      cfg,
	}
}

// Register checks user existence, generates OTP, caches pending registration in Redis, and simulates email.
func (s *authService) Register(ctx context.Context, req *domain.RegisterRequest) error {
	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// Check if user already exists
	existingUser, err := s.userRepo.GetByEmail(ctx, normalizedEmail)
	if err == nil && existingUser != nil {
		return domain.ErrUserAlreadyExists
	}

	// Generate 6-digit OTP
	otp, err := utils.GenerateOTP(6)
	if err != nil {
		return fmt.Errorf("failed to generate OTP: %w", err)
	}

	ttl := time.Duration(s.cfg.Redis.OTPExpiryMinutes) * time.Minute

	pending := &domain.PendingRegistration{
		Name:      strings.TrimSpace(req.Name),
		Age:       req.Age,
		Email:     normalizedEmail,
		OTP:       otp,
		CreatedAt: time.Now(),
	}

	if err := s.otpRepo.SavePendingRegistration(ctx, pending, ttl); err != nil {
		return fmt.Errorf("failed to cache pending registration: %w", err)
	}

	// Simulate sending email (in production, replace with real email service e.g., Resend / AWS SES)
	s.simulateSendEmail(normalizedEmail, otp, "B-Map Registration OTP")

	return nil
}

// Login verifies user exists in PostgreSQL, generates OTP, caches it in Redis, and simulates email.
func (s *authService) Login(ctx context.Context, req *domain.LoginRequest) error {
	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// Ensure user exists
	_, err := s.userRepo.GetByEmail(ctx, normalizedEmail)
	if err != nil {
		return domain.ErrUserNotFound
	}

	// Generate 6-digit OTP
	otp, err := utils.GenerateOTP(6)
	if err != nil {
		return fmt.Errorf("failed to generate OTP: %w", err)
	}

	ttl := time.Duration(s.cfg.Redis.OTPExpiryMinutes) * time.Minute

	if err := s.otpRepo.SaveLoginOTP(ctx, normalizedEmail, otp, ttl); err != nil {
		return fmt.Errorf("failed to cache login OTP: %w", err)
	}

	// Simulate sending email
	s.simulateSendEmail(normalizedEmail, otp, "B-Map Login OTP")

	return nil
}

// VerifyOTP validates the OTP for registration or login, commits to DB, and returns a signed JWT.
func (s *authService) VerifyOTP(ctx context.Context, req *domain.VerifyOTPRequest) (*domain.AuthResponse, error) {
	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))
	otp := strings.TrimSpace(req.OTP)

	// Case 1: Try Registration verification first if purpose is register or not specified
	if req.Purpose == "register" || req.Purpose == "" {
		pending, err := s.otpRepo.GetPendingRegistration(ctx, normalizedEmail)
		if err == nil && pending != nil {
			if pending.OTP != otp {
				return nil, domain.ErrInvalidOTP
			}

			// Create new user in PostgreSQL
			newUser := &domain.User{
				Name:  pending.Name,
				Age:   pending.Age,
				Email: pending.Email,
			}

			if err := s.userRepo.Create(ctx, newUser); err != nil {
				return nil, fmt.Errorf("failed to create user in database: %w", err)
			}

			// Clean up OTP from Redis
			_ = s.otpRepo.DeletePendingRegistration(ctx, normalizedEmail)

			// Generate JWT session
			token, err := utils.GenerateJWT(newUser.ID, newUser.Email, s.cfg.JWT.Secret, s.cfg.JWT.ExpiryHours)
			if err != nil {
				return nil, fmt.Errorf("failed to generate JWT token: %w", err)
			}

			return &domain.AuthResponse{
				Token:     token,
				TokenType: "Bearer",
				ExpiresIn: s.cfg.JWT.ExpiryHours * 3600,
				User:      newUser.ToResponse(),
			}, nil
		}
	}

	// Case 2: Try Login verification
	storedOTP, err := s.otpRepo.GetLoginOTP(ctx, normalizedEmail)
	if err != nil {
		return nil, domain.ErrOTPNotFound
	}

	if storedOTP != otp {
		return nil, domain.ErrInvalidOTP
	}

	user, err := s.userRepo.GetByEmail(ctx, normalizedEmail)
	if err != nil {
		return nil, domain.ErrUserNotFound
	}

	// Clean up OTP from Redis
	_ = s.otpRepo.DeleteLoginOTP(ctx, normalizedEmail)

	// Generate JWT session
	token, err := utils.GenerateJWT(user.ID, user.Email, s.cfg.JWT.Secret, s.cfg.JWT.ExpiryHours)
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT token: %w", err)
	}

	return &domain.AuthResponse{
		Token:     token,
		TokenType: "Bearer",
		ExpiresIn: s.cfg.JWT.ExpiryHours * 3600,
		User:      user.ToResponse(),
	}, nil
}

// simulateSendEmail logs the OTP email simulation with formatting.
func (s *authService) simulateSendEmail(toEmail, otp, subject string) {
	log.Printf("\n========================================================")
	log.Printf("[EMAIL SIMULATOR] To: %s", toEmail)
	log.Printf("[EMAIL SIMULATOR] Subject: %s", subject)
	log.Printf("[EMAIL SIMULATOR] Your One-Time Password (OTP) is: %s", otp)
	log.Printf("[EMAIL SIMULATOR] This OTP is valid for %d minutes.", s.cfg.Redis.OTPExpiryMinutes)
	log.Printf("========================================================\n")
}
