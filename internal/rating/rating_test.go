package rating_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/internal/rating"
)

type mockRatingRepo struct {
	ratings map[uuid.UUID]*domain.Rating
}

func (m *mockRatingRepo) Upsert(ctx context.Context, r *domain.Rating) error {
	m.ratings[r.UserID] = r
	return nil
}

func (m *mockRatingRepo) GetByUserID(ctx context.Context, userID uuid.UUID) (*domain.Rating, error) {
	if r, exists := m.ratings[userID]; exists {
		return r, nil
	}
	return nil, nil
}

func (m *mockRatingRepo) List(ctx context.Context, limit, offset int64) ([]*domain.Rating, int64, error) {
	var list []*domain.Rating
	for _, r := range m.ratings {
		list = append(list, r)
	}
	return list, int64(len(list)), nil
}

func (m *mockRatingRepo) GetStats(ctx context.Context) (*domain.RatingStats, error) {
	dist := map[int]int64{1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
	var total int64
	var sum int64
	for _, r := range m.ratings {
		dist[r.Score]++
		total++
		sum += int64(r.Score)
	}
	avg := 0.0
	if total > 0 {
		avg = float64(sum) / float64(total)
	}
	return &domain.RatingStats{
		AverageScore: avg,
		TotalRatings: total,
		Distribution: dist,
	}, nil
}

func TestRatingService(t *testing.T) {
	ctx := context.Background()
	repo := &mockRatingRepo{ratings: make(map[uuid.UUID]*domain.Rating)}
	svc := rating.NewRatingService(repo)

	userID := uuid.New()
	req := &rating.SubmitRatingRequest{
		Score:    5,
		Feedback: "Best navigation app with NavIC support!",
		Category: "navigation",
	}

	// 1. Submit Rating
	submitted, err := svc.SubmitRating(ctx, userID, "Test User", "test@example.com", req)
	if err != nil {
		t.Fatalf("failed to submit rating: %v", err)
	}
	if submitted.Score != 5 {
		t.Errorf("expected score 5, got %d", submitted.Score)
	}

	// 2. Fetch My Rating
	mine, err := svc.GetMyRating(ctx, userID)
	if err != nil {
		t.Fatalf("failed to get my rating: %v", err)
	}
	if mine == nil || mine.Score != 5 {
		t.Errorf("expected retrieved rating to be 5, got %v", mine)
	}

	// 3. Stats verification
	stats, err := svc.GetRatingStats(ctx)
	if err != nil {
		t.Fatalf("failed to get stats: %v", err)
	}
	if stats.AverageScore != 5.0 || stats.TotalRatings != 1 {
		t.Errorf("stats mismatch: avg=%f, total=%d", stats.AverageScore, stats.TotalRatings)
	}

	// 4. Invalid score should fail
	_, err = svc.SubmitRating(ctx, userID, "Test", "test@example.com", &rating.SubmitRatingRequest{Score: 6})
	if err == nil {
		t.Error("expected error on score > 5, got nil")
	}
}
