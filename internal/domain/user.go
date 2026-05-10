package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Email       string    `json:"email" gorm:"unique;not null"`
	Password    string    `json:"-" gorm:"column:password_hash;not null"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type UserRegistration struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
	FullName string `json:"display_name" validate:"required"`
}

type UserLogin struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type GoogleLogin struct {
	IDToken string `json:"id_token" validate:"required"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type UserRepository interface {
	Create(ctx context.Context, user *User) error
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
}

type UserUsecase interface {
	Register(ctx context.Context, req *UserRegistration) (*AuthResponse, error)
	Login(ctx context.Context, req *UserLogin) (*AuthResponse, error)
	GoogleLogin(ctx context.Context, req *GoogleLogin) (*AuthResponse, error)
	GetProfile(ctx context.Context, userID uuid.UUID) (*User, error)
}
