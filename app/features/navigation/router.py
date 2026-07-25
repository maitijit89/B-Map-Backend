from fastapi import APIRouter, Query, Body, Depends, Header
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.features.navigation.service import NavigationService
from app.core.database import get_db

from app.schemas.navigation import (
    MultiModalPlanRequest,
    MultiModalPlanResponse,
    LaneGuidanceSensorRequest,
    LaneGuidanceResponse,
    DynamicRerouteRequest,
    DynamicRerouteResponse,
    RoutingPreferencesSchema,
    UserPreferencesResponse,
    WeakSignalPositioningRequest,
    DeadReckoningPosition
)

router = APIRouter()
service = NavigationService()

class ComputeRoutesRequest(BaseModel):
    origin: Dict[str, Any]
    destination: Dict[str, Any]
    travel_mode: str = "DRIVE"
    routing_preference: str = "TRAFFIC_AWARE"

class OptimizeRoutesRequest(BaseModel):
    model: Dict[str, Any]

class IndianIntelligenceRequest(BaseModel):
    origin: str
    destination: str
    vehicle_type: str = "car"  # car, suv, bike, auto, truck

@router.get("/directions")
async def get_directions(
    origin: str = Query(..., description="Origin location (lat,lng or place name)"),
    destination: str = Query(..., description="Destination location (lat,lng or place name)"),
    mode: str = Query("driving", enum=["driving", "walking", "bicycling", "transit", "cycling"]),
    transit_preference: str = Query(None, description="Transit routing options: fastest, fewest_transfers, least_walking"),
    intercity_rail_integration: bool = Query(False, description="Integrate intercity rail in transit routing"),
    lang: str = Query("en", description="Language: en or hi"),
    avoid_tolls: bool = Query(False, description="Option to avoid toll roads"),
    avoid_expressways: bool = Query(False, description="Option to avoid highways / expressways"),
    time_priority: bool = Query(True, description="Prioritize fastest route"),
    accept_language: Optional[str] = Header(None, alias="Accept-Language")
):
    preferred_lang = lang
    if accept_language and "hi" in accept_language.lower():
        preferred_lang = "hi"
    return await service.get_directions(
        origin=origin,
        destination=destination,
        mode=mode,
        transit_preference=transit_preference,
        intercity_rail_integration=intercity_rail_integration,
        lang=preferred_lang,
        avoid_tolls=avoid_tolls,
        avoid_expressways=avoid_expressways,
        time_priority=time_priority
    )

@router.post("/indian-intelligence")
async def get_indian_road_intelligence(payload: IndianIntelligenceRequest = Body(...)):
    """
    Returns hyper-local Indian road intelligence: Flyover vs Service Road recommendations, Gali width alerts, FastTag toll estimations, and Monsoon waterlogging alerts.
    """
    return await service.get_indian_road_intelligence(
        origin=payload.origin,
        destination=payload.destination,
        vehicle_type=payload.vehicle_type
    )

@router.get("/lane-guidance")
async def get_lane_guidance(
    origin: str = Query(..., description="Origin coordinate string 'lat,lng'"),
    destination: str = Query(..., description="Destination coordinate string 'lat,lng'")
):
    res = await service.get_directions(origin, destination, mode="driving")
    routes = res.get("routes", [])
    if routes:
        return routes[0].get("lane_level_guidance", {})
    return {}

@router.get("/parking")
async def get_parking(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(2000, description="Search radius in meters"),
    db = Depends(get_db)
):
    return await service.get_nearby_parking(lat, lng, radius, db)

@router.get("/predictive-traffic")
async def get_predictive_traffic(
    origin: str = Query(...),
    destination: str = Query(...),
    departure_time: str = Query(None, description="ISO timestamp or text description")
):
    return await service.get_predictive_traffic(origin, destination, departure_time)

@router.get("/ar-overlay")
async def get_ar_overlay(
    route_id: str = Query(...),
    location: str = Query(...)
):
    return await service.get_ar_overlay(route_id, location)

@router.post("/compute-routes")
async def compute_routes(payload: ComputeRoutesRequest = Body(...)):
    return await service.compute_routes(
        payload.origin,
        payload.destination,
        payload.travel_mode,
        payload.routing_preference
    )

@router.get("/distance-matrix")
async def get_distance_matrix(
    origins: List[str] = Query(..., description="List of origin coordinates/names"),
    destinations: List[str] = Query(..., description="List of destination coordinates/names"),
    mode: str = Query("driving", description="Travel mode")
):
    return await service.get_distance_matrix(origins, destinations, mode)

@router.post("/optimize-routes")
async def optimize_routes(payload: OptimizeRoutesRequest = Body(...)):
    return await service.optimize_routes(payload.model)

@router.get("/snap-to-roads")
async def snap_to_roads(path: str = Query(..., description="Path coordinates, e.g. 'lat1,lng1|lat2,lng2'")):
    return await service.snap_to_roads(path)

@router.get("/speed-limits")
async def get_speed_limits(path: str = Query(..., description="Path coordinates or place IDs, e.g. 'lat1,lng1|lat2,lng2'")):
    return await service.get_speed_limits(path)

@router.post("/multimodal-plan", response_model=MultiModalPlanResponse)
async def get_multimodal_plan(payload: MultiModalPlanRequest = Body(...)):
    """
    Multi-Modal Planning: Generates smart travel itineraries combining driving, walking, cycling, public transit (buses & subways), trains, and airplanes.
    """
    return await service.get_multimodal_plan(
        origin=payload.origin,
        destination=payload.destination,
        allowed_modes=payload.allowed_modes,
        departure_time=payload.departure_time,
        preferences=payload.preferences
    )

@router.post("/lane-guidance/sensor-fusion", response_model=LaneGuidanceResponse)
async def get_lane_guidance_sensor_fusion(payload: LaneGuidanceSensorRequest = Body(...)):
    """
    Lane-Level Navigation: Utilizes high-precision maps and IMU/GPS sensor fusion telemetry to provide exact lane guidance.
    """
    return await service.get_lane_level_guidance_detail(
        origin=payload.origin,
        destination=payload.destination,
        current_lat=payload.current_lat,
        current_lng=payload.current_lng,
        heading=payload.heading,
        current_lane_index=payload.current_lane_index,
        speed_kph=payload.speed_kph
    )

@router.post("/dynamic-reroute", response_model=DynamicRerouteResponse)
async def get_dynamic_reroute(payload: DynamicRerouteRequest = Body(...)):
    """
    Real-Time Traffic & Dynamic Routing: Monitors sudden congestion/incidents and dynamically calculates alternative faster routes.
    """
    return await service.calculate_dynamic_reroute(
        current_route_id=payload.current_route_id,
        current_lat=payload.current_lat,
        current_lng=payload.current_lng,
        destination=payload.destination,
        current_speed_kph=payload.current_speed_kph,
        traffic_event_alert=payload.traffic_event_alert
    )

@router.get("/preferences", response_model=UserPreferencesResponse)
async def get_user_routing_preferences(
    user_id: str = Query("default_user", description="User ID"),
    db = Depends(get_db)
):
    """
    Customizable Preferences: Retrieves stored user route preferences (time priority, avoid tolls, avoid expressways, least walking).
    """
    return await service.get_routing_preferences(user_id=user_id, db=db)

@router.put("/preferences", response_model=UserPreferencesResponse)
async def update_user_routing_preferences(
    user_id: str = Query("default_user", description="User ID"),
    preferences: RoutingPreferencesSchema = Body(...),
    db = Depends(get_db)
):
    """
    Customizable Preferences: Updates user routing preferences.
    """
    return await service.save_routing_preferences(
        user_id=user_id,
        preferences=preferences.model_dump(),
        db=db
    )

@router.post("/weak-signal-positioning", response_model=DeadReckoningPosition)
async def get_weak_signal_positioning(payload: WeakSignalPositioningRequest = Body(...)):
    """
    Weak-Signal Navigation: INS dead-reckoning engine providing continuous positioning when GPS drops (in tunnels or underground parking).
    """
    return await service.calculate_weak_signal_position(
        last_known_lat=payload.last_known_lat,
        last_known_lng=payload.last_known_lng,
        last_known_heading=payload.last_known_heading,
        elapsed_seconds=payload.elapsed_seconds,
        imu_telemetry=payload.imu_telemetry.model_dump(),
        tunnel_or_underground_id=payload.tunnel_or_underground_id
    )

