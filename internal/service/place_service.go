package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/pkg/database"
)

type PlaceService interface {
	CreatePlace(ctx context.Context, req *domain.CreatePlaceRequest, userID *uuid.UUID) (*domain.Place, error)
	GetPlaceByID(ctx context.Context, id uuid.UUID) (*domain.Place, error)
	FindNearby(ctx context.Context, query *domain.NearbyPlacesQuery) ([]domain.Place, int64, error)
}

type placeService struct {
	placeRepo domain.PlaceRepository
}

func NewPlaceService(placeRepo domain.PlaceRepository) PlaceService {
	return &placeService{placeRepo: placeRepo}
}

func (s *placeService) CreatePlace(ctx context.Context, req *domain.CreatePlaceRequest, userID *uuid.UUID) (*domain.Place, error) {
	place := &domain.Place{
		Name:        req.Name,
		Description: req.Description,
		Address:     req.Address,
		Category:    req.Category,
		Location:    database.NewGeoPoint(req.Latitude, req.Longitude),
		PhotoURL:    req.PhotoURL,
		CreatedBy:   userID,
	}

	if err := s.placeRepo.Create(ctx, place); err != nil {
		return nil, err
	}

	return place, nil
}

func (s *placeService) GetPlaceByID(ctx context.Context, id uuid.UUID) (*domain.Place, error) {
	return s.placeRepo.GetByID(ctx, id)
}

func (s *placeService) FindNearby(ctx context.Context, query *domain.NearbyPlacesQuery) ([]domain.Place, int64, error) {
	return s.placeRepo.FindWithinRadius(
		ctx,
		query.Latitude,
		query.Longitude,
		query.RadiusMeters,
		query.Category,
		query.Limit,
		query.Offset,
	)
}
