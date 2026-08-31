package admin

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/analytics"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/internal/rating"
	"github.com/maitijit89/b-map-backend/internal/traffic"
	"github.com/maitijit89/b-map-backend/internal/weather"
)

type OverviewMetrics struct {
	TotalUsers         int64   `json:"total_users"`
	ActiveUsersCount   int     `json:"active_users_count"`
	AverageRating      float64 `json:"average_rating"`
	TotalRatingsCount  int64   `json:"total_ratings_count"`
	TotalActiveMinutes int64   `json:"total_active_minutes"`
	TopFeature         string  `json:"top_feature"`
}

type Service interface {
	GetOverviewMetrics(ctx context.Context) (*OverviewMetrics, error)
	ListUsers(ctx context.Context, search, status, role string, limit, offset int64) ([]*domain.UserResponse, int64, error)
	GetActiveUsers(ctx context.Context) ([]*domain.UserResponse, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*domain.UserResponse, error)
	UpdateUserStatus(ctx context.Context, id uuid.UUID, status string) error
	DeleteUser(ctx context.Context, id uuid.UUID) error
}

type adminService struct {
	userRepo     domain.UserRepository
	ratingSvc    rating.Service
	analyticsSvc analytics.Service
	weatherSvc   weather.Service
	trafficSvc   traffic.Service
}

func NewAdminService(
	userRepo domain.UserRepository,
	ratingSvc rating.Service,
	analyticsSvc analytics.Service,
	weatherSvc weather.Service,
	trafficSvc traffic.Service,
) Service {
	return &adminService{
		userRepo:     userRepo,
		ratingSvc:    ratingSvc,
		analyticsSvc: analyticsSvc,
		weatherSvc:   weatherSvc,
		trafficSvc:   trafficSvc,
	}
}

func (s *adminService) GetOverviewMetrics(ctx context.Context) (*OverviewMetrics, error) {
	// 1. Total users
	_, totalUsers, _ := s.userRepo.List(ctx, "", "", "", 1, 0)

	// 2. Active users in last 10 mins
	activeUsers, _ := s.userRepo.GetActiveUsers(ctx, time.Now().UTC().Add(-10*time.Minute))

	// 3. Ratings stats
	var avgRating float64
	var totalRatings int64
	if s.ratingSvc != nil {
		stats, err := s.ratingSvc.GetRatingStats(ctx)
		if err == nil && stats != nil {
			avgRating = stats.AverageScore
			totalRatings = stats.TotalRatings
		}
	}

	// 4. Feature stats
	topFeature := "Turn-by-Turn Routing"
	if s.analyticsSvc != nil {
		items, _, err := s.analyticsSvc.GetFeatureUsageGraph(ctx)
		if err == nil && len(items) > 0 {
			topFeature = items[0].FeatureName
		}
	}

	return &OverviewMetrics{
		TotalUsers:        totalUsers,
		ActiveUsersCount:  len(activeUsers),
		AverageRating:     avgRating,
		TotalRatingsCount: totalRatings,
		TopFeature:        topFeature,
	}, nil
}

func (s *adminService) ListUsers(ctx context.Context, search, status, role string, limit, offset int64) ([]*domain.UserResponse, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	users, total, err := s.userRepo.List(ctx, search, status, role, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	res := make([]*domain.UserResponse, 0, len(users))
	for _, u := range users {
		res = append(res, u.ToResponse())
	}
	return res, total, nil
}

func (s *adminService) GetActiveUsers(ctx context.Context) ([]*domain.UserResponse, error) {
	// Online within last 10 minutes
	users, err := s.userRepo.GetActiveUsers(ctx, time.Now().UTC().Add(-10*time.Minute))
	if err != nil {
		return nil, err
	}

	res := make([]*domain.UserResponse, 0, len(users))
	for _, u := range users {
		res = append(res, u.ToResponse())
	}
	return res, nil
}

func (s *adminService) GetUserByID(ctx context.Context, id uuid.UUID) (*domain.UserResponse, error) {
	u, err := s.userRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return u.ToResponse(), nil
}

func (s *adminService) UpdateUserStatus(ctx context.Context, id uuid.UUID, status string) error {
	return s.userRepo.UpdateStatus(ctx, id, status)
}

func (s *adminService) DeleteUser(ctx context.Context, id uuid.UUID) error {
	return s.userRepo.Delete(ctx, id)
}
