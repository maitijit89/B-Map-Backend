package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// User represents the core user entity stored in MongoDB.
type User struct {
	ID                 uuid.UUID `json:"id" bson:"_id,omitempty"`
	Name               string    `json:"name" bson:"name"`
	Age                int       `json:"age" bson:"age"`
	Email              string    `json:"email" bson:"email"`
	AvatarURL          string    `json:"avatar_url,omitempty" bson:"avatar_url,omitempty"`
	Role               string    `json:"role" bson:"role"`                                 // "admin" or "user"
	Status             string    `json:"status" bson:"status"`                             // "active" or "suspended"
	LastActiveAt       time.Time `json:"last_active_at" bson:"last_active_at"`             // for live active status
	TotalActiveMinutes int64     `json:"total_active_minutes" bson:"total_active_minutes"` // cumulative app usage
	CurrentLatitude    float64   `json:"current_latitude" bson:"current_latitude"`         // real-time location
	CurrentLongitude   float64   `json:"current_longitude" bson:"current_longitude"`       // real-time location
	Device             string    `json:"device,omitempty" bson:"device,omitempty"`
	ClientIP           string    `json:"client_ip,omitempty" bson:"client_ip,omitempty"`
	CreatedAt          time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt          time.Time `json:"updated_at" bson:"updated_at"`
}

// UserRepository defines the data access contract for User entities.
type UserRepository interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	Update(ctx context.Context, user *User) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, search, status, role string, limit, offset int64) ([]*User, int64, error)
	GetActiveUsers(ctx context.Context, activeSince time.Time) ([]*User, error)
	UpdateTelemetry(ctx context.Context, id uuid.UUID, lat, lng float64, device, ip string) error
	UpdateStatus(ctx context.Context, id uuid.UUID, status string) error
}

// UserResponse is the standardized DTO returned to clients.
type UserResponse struct {
	ID                 uuid.UUID `json:"id"`
	Name               string    `json:"name"`
	Age                int       `json:"age"`
	Email              string    `json:"email"`
	AvatarURL          string    `json:"avatar_url,omitempty"`
	Role               string    `json:"role"`
	Status             string    `json:"status"`
	LastActiveAt       time.Time `json:"last_active_at"`
	TotalActiveMinutes int64     `json:"total_active_minutes"`
	CurrentLatitude    float64   `json:"current_latitude"`
	CurrentLongitude   float64   `json:"current_longitude"`
	Device             string    `json:"device,omitempty"`
	IsActiveNow        bool      `json:"is_active_now"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// ToResponse converts a User domain model to UserResponse DTO.
func (u *User) ToResponse() *UserResponse {
	// A user is considered actively online if seen within the last 10 minutes
	isActiveNow := time.Since(u.LastActiveAt) < 10*time.Minute

	role := u.Role
	if role == "" {
		role = "user"
	}
	status := u.Status
	if status == "" {
		status = "active"
	}

	return &UserResponse{
		ID:                 u.ID,
		Name:               u.Name,
		Age:                u.Age,
		Email:              u.Email,
		AvatarURL:          u.AvatarURL,
		Role:               role,
		Status:             status,
		LastActiveAt:       u.LastActiveAt,
		TotalActiveMinutes: u.TotalActiveMinutes,
		CurrentLatitude:    u.CurrentLatitude,
		CurrentLongitude:   u.CurrentLongitude,
		Device:             u.Device,
		IsActiveNow:        isActiveNow,
		CreatedAt:          u.CreatedAt,
		UpdatedAt:          u.UpdatedAt,
	}
}
