package admin_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/admin"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/internal/traffic"
	"github.com/maitijit89/b-map-backend/internal/weather"
)

type mockUserRepo struct {
	users map[uuid.UUID]*domain.User
}

func (m *mockUserRepo) Create(ctx context.Context, u *domain.User) error {
	m.users[u.ID] = u
	return nil
}

func (m *mockUserRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	if u, exists := m.users[id]; exists {
		return u, nil
	}
	return nil, domain.ErrUserNotFound
}

func (m *mockUserRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	for _, u := range m.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, domain.ErrUserNotFound
}

func (m *mockUserRepo) Update(ctx context.Context, u *domain.User) error {
	m.users[u.ID] = u
	return nil
}

func (m *mockUserRepo) Delete(ctx context.Context, id uuid.UUID) error {
	if _, exists := m.users[id]; exists {
		delete(m.users, id)
		return nil
	}
	return domain.ErrUserNotFound
}

func (m *mockUserRepo) List(ctx context.Context, search, status, role string, limit, offset int64) ([]*domain.User, int64, error) {
	var list []*domain.User
	for _, u := range m.users {
		list = append(list, u)
	}
	return list, int64(len(list)), nil
}

func (m *mockUserRepo) GetActiveUsers(ctx context.Context, activeSince time.Time) ([]*domain.User, error) {
	var list []*domain.User
	for _, u := range m.users {
		if u.LastActiveAt.After(activeSince) && u.Status != "suspended" {
			list = append(list, u)
		}
	}
	return list, nil
}

func (m *mockUserRepo) UpdateTelemetry(ctx context.Context, id uuid.UUID, lat, lng float64, device, ip string) error {
	if u, exists := m.users[id]; exists {
		u.CurrentLatitude = lat
		u.CurrentLongitude = lng
		u.Device = device
		u.ClientIP = ip
		u.LastActiveAt = time.Now().UTC()
		u.TotalActiveMinutes++
		return nil
	}
	return domain.ErrUserNotFound
}

func (m *mockUserRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	if u, exists := m.users[id]; exists {
		u.Status = status
		return nil
	}
	return domain.ErrUserNotFound
}

func TestAdminService(t *testing.T) {
	ctx := context.Background()
	userRepo := &mockUserRepo{users: make(map[uuid.UUID]*domain.User)}

	u1 := &domain.User{
		ID:                 uuid.New(),
		Name:               "Active Driver",
		Email:              "driver@example.com",
		Role:               "user",
		Status:             "active",
		LastActiveAt:       time.Now().UTC(),
		CurrentLatitude:    28.6129,
		CurrentLongitude:   77.2295,
		TotalActiveMinutes: 45,
	}
	userRepo.Create(ctx, u1)

	weatherSvc := weather.NewWeatherService()
	trafficSvc := traffic.NewTrafficService()

	adminSvc := admin.NewAdminService(userRepo, nil, nil, weatherSvc, trafficSvc)

	// 1. Check Active Users
	active, err := adminSvc.GetActiveUsers(ctx)
	if err != nil {
		t.Fatalf("failed to get active users: %v", err)
	}
	if len(active) != 1 {
		t.Fatalf("expected 1 active user, got %d", len(active))
	}
	if active[0].CurrentLatitude != 28.6129 {
		t.Errorf("expected latitude 28.6129, got %f", active[0].CurrentLatitude)
	}

	// 2. Suspend User
	err = adminSvc.UpdateUserStatus(ctx, u1.ID, "suspended")
	if err != nil {
		t.Fatalf("failed to suspend user: %v", err)
	}
	fetched, _ := adminSvc.GetUserByID(ctx, u1.ID)
	if fetched.Status != "suspended" {
		t.Errorf("expected status 'suspended', got %s", fetched.Status)
	}

	// 3. Delete User
	err = adminSvc.DeleteUser(ctx, u1.ID)
	if err != nil {
		t.Fatalf("failed to delete user: %v", err)
	}
	_, err = adminSvc.GetUserByID(ctx, u1.ID)
	if err == nil {
		t.Error("expected error retrieving deleted user, got nil")
	}
}
