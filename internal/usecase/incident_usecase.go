package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/B-Map-Backend/internal/domain"
)

type incidentUsecase struct {
	repo domain.IncidentRepository
	hub  domain.Hub
}

func NewIncidentUsecase(repo domain.IncidentRepository, hub domain.Hub) domain.IncidentUsecase {
	return &incidentUsecase{repo: repo, hub: hub}
}

func (u *incidentUsecase) Report(ctx context.Context, reporterID uuid.UUID, req *domain.IncidentReport) (*domain.Incident, error) {
	expiresAt := time.Now().Add(24 * time.Hour) // Default expiry 24h
	
	incident := &domain.Incident{
		Type:        req.Type,
		Severity:    req.Severity,
		Description: req.Description,
		Lat:         req.Lat,
		Lng:         req.Lng,
		ReporterID:  &reporterID,
		IsActive:    true,
		CreatedAt:   time.Now(),
		ExpiresAt:   &expiresAt,
	}

	if err := u.repo.Create(ctx, incident); err != nil {
		return nil, err
	}

	// Broadcast to connected users
	if u.hub != nil {
		u.hub.BroadcastIncident(incident)
	}

	return incident, nil
}

func (u *incidentUsecase) GetNearby(ctx context.Context, query *domain.IncidentQuery) ([]domain.Incident, error) {
	if query.Radius == 0 {
		query.Radius = 5000 // Default 5km
	}
	return u.repo.GetNearby(ctx, query.Lat, query.Lng, query.Radius)
}

func (u *incidentUsecase) Upvote(ctx context.Context, id uuid.UUID) error {
	return u.repo.Upvote(ctx, id)
}
