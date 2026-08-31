package fleet

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/internal/domain"
	"github.com/maitijit89/b-map-backend/internal/realtime"
	"github.com/maitijit89/b-map-backend/internal/routes"
	"github.com/maitijit89/b-map-backend/internal/spatial"
	"github.com/maitijit89/b-map-backend/pkg/database"
	"github.com/maitijit89/b-map-backend/pkg/utils"
	"gorm.io/gorm"
)

type LocationUpdatePayload struct {
	DriverID  string  `json:"driver_id"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Heading   float64 `json:"heading"`
	SpeedKmh  float64 `json:"speed_kmh"`
}

type TripRequestPayload struct {
	RiderID         uuid.UUID        `json:"rider_id"`
	Pickup          utils.Coordinate `json:"pickup"`
	Dropoff         utils.Coordinate `json:"dropoff"`
	PickupAddress   string           `json:"pickup_address"`
	DropoffAddress  string           `json:"dropoff_address"`
}

type Service interface {
	UpdateDriverLocation(ctx context.Context, payload *LocationUpdatePayload) error
	GetNearbyDrivers(ctx context.Context, lat, lng, radius float64, limit int) ([]spatial.NearbyDriver, error)
	RequestTrip(ctx context.Context, req *TripRequestPayload) (*domain.Trip, error)
	AcceptTrip(ctx context.Context, driverID, tripID uuid.UUID) (*domain.Trip, error)
	GetTripByID(ctx context.Context, tripID uuid.UUID) (*domain.Trip, error)
	CompleteTrip(ctx context.Context, tripID uuid.UUID) (*domain.Trip, error)
}

type fleetService struct {
	db             *gorm.DB
	spatialIndexer spatial.SpatialIndexer
	routesEngine   routes.Engine
	hub            *realtime.Hub
}

func NewFleetService(db *gorm.DB, indexer spatial.SpatialIndexer, routesEngine routes.Engine, hub *realtime.Hub) Service {
	return &fleetService{
		db:             db,
		spatialIndexer: indexer,
		routesEngine:   routesEngine,
		hub:            hub,
	}
}

// UpdateDriverLocation updates the spatial index and broadcasts live telemetry.
func (s *fleetService) UpdateDriverLocation(ctx context.Context, p *LocationUpdatePayload) error {
	// 1. Update in Redis GEO
	if err := s.spatialIndexer.UpdateDriverPosition(ctx, p.DriverID, p.Latitude, p.Longitude, p.Heading, p.SpeedKmh); err != nil {
		return fmt.Errorf("failed to update Redis GEO location: %w", err)
	}

	// 2. Broadcast to Real-Time Hub / Redis PubSub
	msg := &realtime.Message{
		Event: "driver_location_update",
		Data:  p,
	}
	s.hub.BroadcastLocal(msg)
	_ = s.hub.BroadcastCluster(ctx, "fleet:broadcast", msg)

	return nil
}

// GetNearbyDrivers fetches drivers within radius from Redis GEO.
func (s *fleetService) GetNearbyDrivers(ctx context.Context, lat, lng, radius float64, limit int) ([]spatial.NearbyDriver, error) {
	return s.spatialIndexer.FindNearbyDrivers(ctx, lat, lng, radius, limit)
}

// RequestTrip computes route distance/ETA, estimates fare, creates Trip in DB, and dispatches real-time broadcast.
func (s *fleetService) RequestTrip(ctx context.Context, req *TripRequestPayload) (*domain.Trip, error) {
	// 1. Calculate Route using Routes Engine
	route, err := s.routesEngine.CalculateRoute(ctx, &routes.RouteRequest{
		Origin:      req.Pickup,
		Destination: req.Dropoff,
		Mode:        routes.TravelModeDriving,
	})
	if err != nil {
		return nil, fmt.Errorf("route calculation failed: %w", err)
	}

	// 2. Estimate Fare: Base ($2.50) + $1.25/km + $0.30/min
	distanceKm := route.DistanceMeters / 1000.0
	durationMin := float64(route.DurationSeconds) / 60.0
	fare := 2.50 + (1.25 * distanceKm) + (0.30 * durationMin)
	fare = math.Round(fare*100) / 100

	// 3. Save Trip to PostgreSQL
	trip := &domain.Trip{
		RiderID:         req.RiderID,
		Status:          domain.TripStatusRequested,
		PickupLocation:  database.NewGeoPoint(req.Pickup.Latitude, req.Pickup.Longitude),
		DropoffLocation: database.NewGeoPoint(req.Dropoff.Latitude, req.Dropoff.Longitude),
		PickupAddress:   req.PickupAddress,
		DropoffAddress:  req.DropoffAddress,
		DistanceMeters:  route.DistanceMeters,
		DurationSeconds: route.DurationSeconds,
		FareAmount:      fare,
		RoutePolyline:   route.OverviewPolyline,
	}

	if err := s.db.WithContext(ctx).Create(trip).Error; err != nil {
		return nil, fmt.Errorf("failed to create trip in database: %w", err)
	}

	// 4. Notify Nearby Drivers via Real-Time Broadcast
	msg := &realtime.Message{
		Event: "new_trip_requested",
		Data: map[string]interface{}{
			"trip_id":          trip.ID,
			"pickup_location":  req.Pickup,
			"dropoff_location": req.Dropoff,
			"distance_meters":  trip.DistanceMeters,
			"fare_amount":      trip.FareAmount,
		},
	}
	s.hub.BroadcastLocal(msg)
	_ = s.hub.BroadcastCluster(ctx, "fleet:trips", msg)

	return trip, nil
}

// AcceptTrip assigns driver to the requested trip.
func (s *fleetService) AcceptTrip(ctx context.Context, driverID, tripID uuid.UUID) (*domain.Trip, error) {
	var trip domain.Trip
	if err := s.db.WithContext(ctx).First(&trip, "id = ?", tripID).Error; err != nil {
		return nil, errors.New("trip not found")
	}

	if trip.Status != domain.TripStatusRequested {
		return nil, errors.New("trip is no longer available for acceptance")
	}

	trip.DriverID = &driverID
	trip.Status = domain.TripStatusAccepted

	if err := s.db.WithContext(ctx).Save(&trip).Error; err != nil {
		return nil, err
	}

	// Broadcast status update to trip room
	msg := &realtime.Message{
		Event: "trip_status_changed",
		Room:  "trip:" + trip.ID.String(),
		Data: map[string]interface{}{
			"trip_id":   trip.ID,
			"driver_id": driverID,
			"status":    trip.Status,
		},
	}
	s.hub.BroadcastLocal(msg)
	_ = s.hub.BroadcastCluster(ctx, "fleet:trips", msg)

	return &trip, nil
}

func (s *fleetService) GetTripByID(ctx context.Context, tripID uuid.UUID) (*domain.Trip, error) {
	var trip domain.Trip
	if err := s.db.WithContext(ctx).First(&trip, "id = ?", tripID).Error; err != nil {
		return nil, err
	}
	return &trip, nil
}

func (s *fleetService) CompleteTrip(ctx context.Context, tripID uuid.UUID) (*domain.Trip, error) {
	var trip domain.Trip
	if err := s.db.WithContext(ctx).First(&trip, "id = ?", tripID).Error; err != nil {
		return nil, err
	}

	now := time.Now()
	trip.Status = domain.TripStatusCompleted
	trip.CompletedAt = &now

	if err := s.db.WithContext(ctx).Save(&trip).Error; err != nil {
		return nil, err
	}

	msg := &realtime.Message{
		Event: "trip_completed",
		Room:  "trip:" + trip.ID.String(),
		Data:  trip,
	}
	s.hub.BroadcastLocal(msg)
	_ = s.hub.BroadcastCluster(ctx, "fleet:trips", msg)

	return &trip, nil
}
