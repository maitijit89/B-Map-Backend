package domain

import (
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/pkg/database"
)

// RoadNode represents a road junction or intersection for the routing graph.
type RoadNode struct {
	ID        int64             `json:"id" bson:"_id,omitempty"`
	Location  database.GeoPoint `json:"location" bson:"location"`
	CreatedAt time.Time         `json:"created_at" bson:"created_at"`
}

// RoadEdge represents a directed road segment connecting two RoadNodes.
type RoadEdge struct {
	ID           int64             `json:"id" bson:"_id,omitempty"`
	SourceNodeID int64             `json:"source_node_id" bson:"source_node_id"`
	TargetNodeID int64             `json:"target_node_id" bson:"target_node_id"`
	Name         string            `json:"name" bson:"name"`
	RoadType     string            `json:"road_type" bson:"road_type"` // motorway, primary, secondary, residential
	LengthMeters float64           `json:"length_meters" bson:"length_meters"`
	MaxSpeedKmh  float64           `json:"max_speed_kmh" bson:"max_speed_kmh"`
	OneWay       bool              `json:"one_way" bson:"one_way"`
	Geometry     database.GeoPoint `json:"geometry,omitempty" bson:"geometry,omitempty"`
	CreatedAt    time.Time         `json:"created_at" bson:"created_at"`
}

// VehicleStatus defines the operational state of a fleet vehicle.
type VehicleStatus string

const (
	VehicleStatusIdle     VehicleStatus = "idle"
	VehicleStatusAssigned VehicleStatus = "assigned"
	VehicleStatusEnRoute  VehicleStatus = "en_route"
	VehicleStatusOffline  VehicleStatus = "offline"
)

// Vehicle represents an active fleet driver in real-time tracking.
type Vehicle struct {
	ID            uuid.UUID         `json:"id" bson:"_id,omitempty"`
	DriverID      uuid.UUID         `json:"driver_id" bson:"driver_id"`
	DriverName    string            `json:"driver_name" bson:"driver_name"`
	LicensePlate  string            `json:"license_plate" bson:"license_plate"`
	VehicleType   string            `json:"vehicle_type" bson:"vehicle_type"` // car, bike, truck
	Status        VehicleStatus     `json:"status" bson:"status"`
	Location      database.GeoPoint `json:"location" bson:"location"`
	Heading       float64           `json:"heading" bson:"heading"` // 0-360 degrees
	SpeedKmh      float64           `json:"speed_kmh" bson:"speed_kmh"`
	LastUpdatedAt time.Time         `json:"last_updated_at" bson:"last_updated_at"`
}

// TripStatus defines the lifecycle of a ride / delivery trip.
type TripStatus string

const (
	TripStatusRequested TripStatus = "requested"
	TripStatusAccepted  TripStatus = "accepted"
	TripStatusArrived   TripStatus = "arrived"
	TripStatusActive    TripStatus = "in_progress"
	TripStatusCompleted TripStatus = "completed"
	TripStatusCancelled TripStatus = "cancelled"
)

// Trip represents a rider or delivery mission.
type Trip struct {
	ID              uuid.UUID         `json:"id" bson:"_id,omitempty"`
	RiderID         uuid.UUID         `json:"rider_id" bson:"rider_id"`
	DriverID        *uuid.UUID        `json:"driver_id,omitempty" bson:"driver_id,omitempty"`
	Status          TripStatus        `json:"status" bson:"status"`
	PickupLocation  database.GeoPoint `json:"pickup_location" bson:"pickup_location"`
	DropoffLocation database.GeoPoint `json:"dropoff_location" bson:"dropoff_location"`
	PickupAddress   string            `json:"pickup_address" bson:"pickup_address"`
	DropoffAddress  string            `json:"dropoff_address" bson:"dropoff_address"`
	DistanceMeters  float64           `json:"distance_meters" bson:"distance_meters"`
	DurationSeconds int               `json:"duration_seconds" bson:"duration_seconds"`
	FareAmount      float64           `json:"fare_amount" bson:"fare_amount"`
	RoutePolyline   string            `json:"route_polyline,omitempty" bson:"route_polyline,omitempty"`
	CreatedAt       time.Time         `json:"created_at" bson:"created_at"`
	CompletedAt     *time.Time        `json:"completed_at,omitempty" bson:"completed_at,omitempty"`
}

// Geofence represents a monitored geographic boundary.
type Geofence struct {
	ID           uuid.UUID         `json:"id" bson:"_id,omitempty"`
	Name         string            `json:"name" bson:"name"`
	Description  string            `json:"description" bson:"description"`
	CenterPoint  database.GeoPoint `json:"center_point" bson:"center_point"`
	RadiusMeters float64           `json:"radius_meters" bson:"radius_meters"`
	Action       string            `json:"action" bson:"action"` // alert_entry, alert_exit, speed_limit
	IsActive     bool              `json:"is_active" bson:"is_active"`
	CreatedAt    time.Time         `json:"created_at" bson:"created_at"`
}
