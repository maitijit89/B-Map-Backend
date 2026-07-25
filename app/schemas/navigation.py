from pydantic import Field
from typing import List, Dict, Any, Optional
from app.schemas.base import SecureBaseModel

# --- Multi-Modal Planning Schemas ---
class MultiModalPlanRequest(SecureBaseModel):
    origin: str = Field(..., min_length=1, max_length=256, description="Origin location (lat,lng or place name)")
    destination: str = Field(..., min_length=1, max_length=256, description="Destination location (lat,lng or place name)")
    allowed_modes: Optional[List[str]] = Field(
        default=["driving", "walking", "cycling", "transit", "train", "airplane"],
        description="Allowed modes of transportation"
    )
    departure_time: Optional[str] = Field(None, max_length=100, description="ISO timestamp for departure")
    preferences: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Custom routing preferences like avoid_tolls, time_priority, etc."
    )

class LegSegment(SecureBaseModel):
    mode: str = Field(..., max_length=50)
    start_location: str = Field(..., max_length=256)
    end_location: str = Field(..., max_length=256)
    distance_meters: float = Field(..., ge=0.0)
    duration_seconds: float = Field(..., ge=0.0)
    instructions: str = Field(..., max_length=1000)
    line_name: Optional[str] = Field(None, max_length=100)
    departure_time: Optional[str] = Field(None, max_length=100)
    arrival_time: Optional[str] = Field(None, max_length=100)
    cost_inr: Optional[float] = Field(None, ge=0.0)

class MultiModalItinerary(SecureBaseModel):
    itinerary_id: str = Field(..., max_length=100)
    total_duration_seconds: float = Field(..., ge=0.0)
    total_distance_meters: float = Field(..., ge=0.0)
    total_cost_inr: float = Field(..., ge=0.0)
    segments: List[LegSegment]
    transfer_points_count: int = Field(..., ge=0)
    eco_carbon_saved_kg: float = Field(..., ge=0.0)

class MultiModalPlanResponse(SecureBaseModel):
    status: str = Field("OK", max_length=20)
    origin: str = Field(..., max_length=256)
    destination: str = Field(..., max_length=256)
    recommended_itinerary: MultiModalItinerary
    alternative_itineraries: List[MultiModalItinerary]


# --- Lane-Level Navigation Schemas ---
class LaneDetail(SecureBaseModel):
    index: int = Field(..., ge=0, le=20)
    type: str = Field(..., max_length=50)
    active: bool
    description: str = Field(..., max_length=256)

class LaneGuidanceSensorRequest(SecureBaseModel):
    origin: str = Field(..., max_length=256)
    destination: str = Field(..., max_length=256)
    current_lat: float = Field(..., ge=-90.0, le=90.0)
    current_lng: float = Field(..., ge=-180.0, le=180.0)
    heading: float = Field(..., ge=0.0, le=360.0)
    current_lane_index: Optional[int] = Field(None, ge=0, le=20)
    speed_kph: Optional[float] = Field(0.0, ge=0.0, le=350.0)

class LaneGuidanceResponse(SecureBaseModel):
    supported: bool = True
    active_lane_recommendation: int = Field(..., ge=0)
    lanes: List[LaneDetail]
    next_maneuver: str = Field(..., max_length=500)
    distance_to_maneuver_meters: float = Field(..., ge=0.0)
    sensor_confidence: float = Field(..., ge=0.0, le=1.0)
    high_precision_map_active: bool = True


# --- Real-Time Traffic & Dynamic Routing Schemas ---
class DynamicRerouteRequest(SecureBaseModel):
    current_route_id: str = Field(..., max_length=100)
    current_lat: float = Field(..., ge=-90.0, le=90.0)
    current_lng: float = Field(..., ge=-180.0, le=180.0)
    destination: str = Field(..., max_length=256)
    current_speed_kph: float = Field(..., ge=0.0, le=350.0)
    traffic_event_alert: Optional[str] = Field(None, max_length=100)

class DynamicRerouteResponse(SecureBaseModel):
    reroute_recommended: bool
    reason: str = Field(..., max_length=500)
    original_route_eta_mins: float = Field(..., ge=0.0)
    new_route_eta_mins: float = Field(..., ge=0.0)
    time_saved_mins: float = Field(..., ge=0.0)
    new_route_summary: str = Field(..., max_length=500)
    polyline_points: List[List[float]] = []


# --- Customizable Preferences Schemas ---
class RoutingPreferencesSchema(SecureBaseModel):
    routing_priority: str = Field("time_priority", max_length=50)
    avoid_tolls: bool = False
    avoid_expressways: bool = False
    avoid_ferries: bool = False
    transit_preference: str = Field("least_walking", max_length=50)
    preferred_vehicle_type: str = Field("car", max_length=50)

class UserPreferencesResponse(SecureBaseModel):
    user_id: str = Field(..., max_length=100)
    preferences: RoutingPreferencesSchema


# --- Weak-Signal Navigation Schemas ---
class ImuTelemetry(SecureBaseModel):
    accel_x: float = Field(0.0, ge=-50.0, le=50.0)
    accel_y: float = Field(0.0, ge=-50.0, le=50.0)
    accel_z: float = Field(0.0, ge=-50.0, le=50.0)
    gyro_yaw: float = Field(0.0, ge=-360.0, le=360.0)
    wheel_speed_kph: float = Field(0.0, ge=0.0, le=350.0)
    timestamp_ms: int = Field(..., ge=0)

class WeakSignalPositioningRequest(SecureBaseModel):
    last_known_lat: float = Field(..., ge=-90.0, le=90.0)
    last_known_lng: float = Field(..., ge=-180.0, le=180.0)
    last_known_heading: float = Field(..., ge=0.0, le=360.0)
    elapsed_seconds: float = Field(..., ge=0.0, le=86400.0)
    imu_telemetry: ImuTelemetry
    tunnel_or_underground_id: Optional[str] = Field(None, max_length=100)

class DeadReckoningPosition(SecureBaseModel):
    estimated_lat: float = Field(..., ge=-90.0, le=90.0)
    estimated_lng: float = Field(..., ge=-180.0, le=180.0)
    estimated_heading: float = Field(..., ge=0.0, le=360.0)
    confidence_radius_meters: float = Field(..., ge=0.0)
    dead_reckoning_active: bool = True
    positioning_source: str = Field("INS_DEAD_RECKONING_MAP_MATCH", max_length=100)
    estimated_tunnel_exit_seconds: float = Field(..., ge=0.0)
