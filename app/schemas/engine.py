from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class SpatialSearchRequest(BaseModel):
    query: str = Field(..., description="Search text query")
    places: List[Dict[str, Any]] = Field(..., description="List of candidate place objects to rank")
    user_lat: Optional[float] = Field(None, description="User latitude")
    user_lng: Optional[float] = Field(None, description="User longitude")
    max_results: int = Field(10, ge=1, le=100, description="Maximum results to return")

class GraphRoutingRequest(BaseModel):
    nodes: List[Dict[str, Any]] = Field(..., description="Nodes list with 'id', 'lat', 'lng'")
    edges: List[Dict[str, Any]] = Field(..., description="Edges list with 'u', 'v', optional 'speed_kph', 'toll', 'surface', 'is_one_way'")
    start_id: str = Field(..., description="Origin node ID")
    goal_id: str = Field(..., description="Destination node ID")
    criteria: str = Field("fastest", description="Optimization criteria: fastest, shortest, eco")

class NavigationTrackRequest(BaseModel):
    route_points: List[Dict[str, float]] = Field(..., description="Route polyline coordinate points with lat and lng")
    user_lat: float = Field(..., description="Current user latitude")
    user_lng: float = Field(..., description="Current user longitude")

class MapMatchingRequest(BaseModel):
    gps_trace: List[List[float]] = Field(..., description="List of [lat, lng] tuples representing noisy GPS trace")
    road_segments: Optional[List[Dict[str, Any]]] = Field(None, description="Optional custom road network segments")
    sigma_z: float = Field(10.0, description="GPS noise standard deviation in meters")
    beta: float = Field(5.0, description="Transition scale parameter")

class LaneGuidanceRequest(BaseModel):
    total_lanes: int = Field(4, ge=1, le=12, description="Total number of highway/road lanes")
    maneuver_type: str = Field("TURN_LEFT", description="Next navigation maneuver type")

class GeofenceCheckRequest(BaseModel):
    user_lat: float = Field(..., description="Current user latitude")
    user_lng: float = Field(..., description="Current user longitude")
    speed_kph: float = Field(0.0, ge=0.0, description="Current speed in km/h")
    active_geofences: Optional[List[Dict[str, Any]]] = Field(None, description="Optional custom active geofences list")

class IsochroneRequest(BaseModel):
    center_lat: float = Field(..., description="Center origin latitude")
    center_lng: float = Field(..., description="Center origin longitude")
    time_budget_seconds: int = Field(900, ge=60, le=86400, description="Time budget in seconds")
    travel_mode: str = Field("driving", description="Travel mode: driving, cycling, walking, transit, ev")
    traffic_factor: float = Field(0.85, ge=0.1, le=2.0, description="Traffic congestion modifier factor")
    num_vertices: int = Field(12, ge=4, le=72, description="Polygon boundary vertex resolution")

class MultiRingIsochroneRequest(BaseModel):
    center_lat: float = Field(..., description="Center origin latitude")
    center_lng: float = Field(..., description="Center origin longitude")
    time_budgets_seconds: Optional[List[int]] = Field(default=[300, 600, 900, 1800], description="List of time budgets in seconds")
    travel_mode: str = Field("driving", description="Travel mode: driving, cycling, walking, transit, ev")

class EVEnergyRequest(BaseModel):
    distance_km: float = Field(..., ge=0.0, description="Trip distance in kilometers")
    elevation_gain_meters: float = Field(0.0, ge=0.0, description="Elevation gain in meters")
    battery_capacity_kwh: float = Field(60.0, gt=0.0, description="EV battery capacity in kWh")
    current_soc_percent: float = Field(80.0, ge=0.0, le=100.0, description="Current State of Charge percentage")
    vehicle_efficiency_wh_per_km: float = Field(150.0, gt=0.0, description="Vehicle efficiency in Wh/km")
    ambient_temp_celsius: float = Field(30.0, description="Ambient weather temperature in Celsius")

class EVChargingPlannerRequest(BaseModel):
    route_distance_km: float = Field(..., ge=0.0, description="Route distance in kilometers")
    current_soc_percent: float = Field(80.0, ge=0.0, le=100.0, description="Current State of Charge percentage")
    chargers_along_route: Optional[List[Dict[str, Any]]] = Field(None, description="Optional available chargers list along route")

class DeadReckoningRequest(BaseModel):
    last_known_lat: float = Field(..., description="Last verified GPS latitude")
    last_known_lng: float = Field(..., description="Last verified GPS longitude")
    last_known_heading: float = Field(..., ge=0.0, lt=360.0, description="Heading angle in degrees (0-360)")
    elapsed_seconds: float = Field(..., gt=0.0, description="Elapsed time in seconds since last update")
    accel_x: float = Field(0.0, description="3-axis accelerometer X force")
    accel_y: float = Field(0.2, description="3-axis accelerometer Y force (longitudinal)")
    accel_z: float = Field(9.81, description="3-axis accelerometer Z force (gravity)")
    gyro_yaw_deg_s: float = Field(0.0, description="Gyroscope yaw angular rate in deg/s")
    wheel_speed_kph: Optional[float] = Field(None, ge=0.0, description="CAN bus wheel tick encoder speed")
    last_confidence_radius_m: float = Field(2.0, ge=0.0, description="Previous EKF error confidence radius in meters")

class MonsoonSafetyRequest(BaseModel):
    rainfall_mm_per_hr: float = Field(0.0, ge=0.0, description="Live rain intensity in mm/hour")
    underpasses_count: int = Field(0, ge=0, description="Number of low-lying underpasses on route")
    recent_waterlogging_reports: int = Field(0, ge=0, description="User reported waterlogging incident count")

class TrafficPredictionRequest(BaseModel):
    hour_of_day: int = Field(..., ge=0, le=23, description="Hour of the day (0-23)")
    day_of_week: int = Field(0, ge=0, le=6, description="Day of week (0=Monday, 6=Sunday)")
    rain_intensity_mm: float = Field(0.0, ge=0.0, description="Rainfall intensity in mm/hour")
    event_density: float = Field(0.0, ge=0.0, description="Event/protest/construction density score")

class OptimalDepartureRequest(BaseModel):
    target_departure_hour: int = Field(..., ge=0, le=23, description="Desired departure hour (0-23)")
    day_of_week: int = Field(0, ge=0, le=6, description="Day of week (0=Monday, 6=Sunday)")
