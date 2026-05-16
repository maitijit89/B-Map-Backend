package usecase

import (
	"context"
	"errors"
	"log"

	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
	"github.com/maitijit89/B-Map-Backend/pkg/auth"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/api/idtoken"
)

type userUsecase struct {
	repo domain.UserRepository
}

func NewUserUsecase(repo domain.UserRepository) domain.UserUsecase {
	return &userUsecase{repo: repo}
}

func (u *userUsecase) Register(ctx context.Context, req *domain.UserRegistration) (*domain.AuthResponse, error) {
	// Check if user exists
	existingUser, _ := u.repo.GetByEmail(ctx, req.Email)
	if existingUser != nil {
		return nil, errors.New("email already in use")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	user := &domain.User{
		Email:       req.Email,
		DisplayName: req.FullName,
		Password:    string(hashedPassword),
	}

	if err := u.repo.Create(ctx, user); err != nil {
		return nil, err
	}

	token, err := auth.GenerateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &domain.AuthResponse{
		Token: token,
		User:  *user,
	}, nil
}

func (u *userUsecase) Login(ctx context.Context, req *domain.UserLogin) (*domain.AuthResponse, error) {
	user, err := u.repo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, errors.New("invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	token, err := auth.GenerateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &domain.AuthResponse{
		Token: token,
		User:  *user,
	}, nil
}

func (u *userUsecase) GoogleLogin(ctx context.Context, req *domain.GoogleLogin) (*domain.AuthResponse, error) {
	// Use empty string for audience to bypass validation against a single client ID.
	// This is necessary because Android, Web, and iOS clients may use different client IDs
	// while still sharing the same Firebase/Google Cloud project.
	payload, err := idtoken.Validate(ctx, req.IDToken, "")
	if err != nil {
		log.Printf("Google ID Token validation failed: %v", err)
		return nil, errors.New("invalid google token: " + err.Error())
	}

	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)

	if email == "" {
		return nil, errors.New("email not found in google token")
	}

	// Check if user exists
	user, err := u.repo.GetByEmail(ctx, email)
	if err != nil {
		// Create new user if not exists
		user = &domain.User{
			Email:       email,
			DisplayName: name,
			Password:    "GOOGLE_AUTH_USER_" + uuid.New().String()[:8], // Randomize dummy password
		}
		if err := u.repo.Create(ctx, user); err != nil {
			return nil, err
		}
	}

	token, err := auth.GenerateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &domain.AuthResponse{
		Token: token,
		User:  *user,
	}, nil
}

func (u *userUsecase) GetProfile(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	return u.repo.GetByID(ctx, userID)
}
