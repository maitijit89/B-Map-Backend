package usecase

import (
	"context"
	"errors"
	"os"

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
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &domain.User{
		Email:       req.Email,
		Password:    string(hashedPassword),
		DisplayName: req.FullName,
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
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	payload, err := idtoken.Validate(ctx, req.IDToken, clientID)
	if err != nil {
		return nil, errors.New("invalid google token")
	}

	email := payload.Claims["email"].(string)
	name := payload.Claims["name"].(string)

	// Check if user exists
	user, err := u.repo.GetByEmail(ctx, email)
	if err != nil {
		// Create new user if not exists
		user = &domain.User{
			Email:       email,
			DisplayName: name,
			Password:    "GOOGLE_AUTH_USER", // Dummy password
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
