package domain

import (
	"time"

	"github.com/google/uuid"
	"github.com/maitijit89/b-map-backend/pkg/database"
)

// RoadNode represents a road junction or intersection for the routing graph.
type RoadNode struct {
	ID        int64             `gorm:"primaryKey;autoIncrement" json:"id"`
	Location  database.GeoPoint `gorm:"type:geometry(Point,4326);not null;index:idx_nodes_loc,type:gist" json:"location"`
	CreatedAt time.Time         `gorm:"autoCreateTime" json:"created_at"`
}

// RoadEdge represents a directed road segment connecting two RoadNodes.
type RoadEdge struct {
	ID           int64             `gorm:"primaryKey;autoIncrement" json:"id"`
	SourceNodeID int64             `gorm:"not null;index:idx_edges_src" json:"source_node_id"`
	TargetNodeID int64             `gorm:"not null;index:idx_edges_tgt" json:"target_node_id"`
	Name         string            `gorm:"type:varchar(255);index" json:"name"`
	RoadType     string            `gorm:"type:varchar(50);default:'primary'" json:"road_type"` // motorway, primary, secondary, residential
	LengthMeters float64           `gorm:"type:numeric(10,2);not null" json:"length_meters"`
	MaxSpeedKmh  float64           `gorm:"type:numeric(5,2);default:50.0" json:"max_speed_kmh"`
	OneWay       bool              `gorm:"default:false" json:"one_way"`
	Geometry     database.GeoPoint `gorm:"type:geometry(Point,4326)" json:"geometry,omitempty"`
	CreatedAt    time.Time         `gorm:"autoCreateTime" json:"created_at"`
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
	ID            uuid.UUID         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DriverID      uuid.UUID         `gorm:"type:uuid;not null;index" json:"driver_id"`
	DriverName    string            `gorm:"type:varchar(100);not null" json:"driver_name"`
	LicensePlate  string            `gorm:"type:varchar(30);not null" json:"license_plate"`
	VehicleType   string            `gorm:"type:varchar(50);default:'car'" json:"vehicle_type"` // car, bike, truck
	Status        VehicleStatus     `gorm:"type:varchar(20);default:'idle';index" json:"status"`
	Location      database.GeoPoint `gorm:"type:geometry(Point,4326);not null;index:idx_vehicle_loc,type:gist" json:"location"`
	Heading       float64           `gorm:"type:numeric(5,2);default:0.0" json:"heading"` // 0-360 degrees
	SpeedKmh      float64           `gorm:"type:numeric(5,2);default:0.0" json:"speed_kmh"`
	LastUpdatedAt time.Time         `gorm:"autoUpdateTime" json:"last_updated_at"`
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
	ID              uuid.UUID         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	RiderID         uuid.UUID         `gorm:"type:uuid;not null;index" json:"rider_id"`
	DriverID        *uuid.UUID        `gorm:"type:uuid;index" json:"driver_id,omitempty"`
	Status          TripStatus        `gorm:"type:varchar(30);default:'requested';index" json:"status"`
	PickupLocation  database.GeoPoint `gorm:"type:geometry(Point,4326);not null" json:"pickup_location"`
	DropoffLocation database.GeoPoint `gorm:"type:geometry(Point,4326);not null" json:"dropoff_location"`
	PickupAddress   string            `gorm:"type:varchar(512)" json:"pickup_address"`
	DropoffAddress  string            `gorm:"type:varchar(512)" json:"dropoff_address"`
	DistanceMeters  float64           `gorm:"type:numeric(10,2)" json:"distance_meters"`
	DurationSeconds int               `json:"duration_seconds"`
	FareAmount      float64           `gorm:"type:numeric(10,2)" json:"fare_amount"`
	RoutePolyline   string            `gorm:"type:text" json:"route_polyline,omitempty"`
	CreatedAt       time.Time         `gorm:"autoCreateTime" json:"created_at"`
	CompletedAt     *time.Time        `json:"completed_at,omitempty"`
}

// Geofence represents a monitored geographic boundary.
type Geofence struct {
	ID           uuid.UUID         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name         string            `gorm:"type:varchar(255);not null" json:"name"`
	Description  string            `gorm:"type:text" json:"description"`
	CenterPoint  database.GeoPoint `gorm:"type:geometry(Point,4326);not null" json:"center_point"`
	RadiusMeters float64           `gorm:"type:numeric(10,2);not null" json:"radius_meters"`
	Action       string            `gorm:"type:varchar(100)" json:"action"` // alert_entry, alert_exit, speed_limit
	IsActive     bool              `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time         `gorm:"autoCreateTime" json:"created_at"`
}
