from fastapi import APIRouter, Query, Body, Depends, Header
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.navigation_service import NavigationService
from app.db.session import get_db

router = APIRouter()
service = NavigationService()

class ComputeRoutesRequest(BaseModel):
    origin: Dict[str, Any]
    destination: Dict[str, Any]
    travel_mode: str = "DRIVE"
    routing_preference: str = "TRAFFIC_AWARE"

class OptimizeRoutesRequest(BaseModel):
    model: Dict[str, Any]

@router.get("/directions")
async def get_directions(
    origin: str = Query(..., description="Origin location (lat,lng or place name)"),
    destination: str = Query(..., description="Destination location (lat,lng or place name)"),
    mode: str = Query("driving", enum=["driving", "walking", "bicycling", "transit", "cycling"]),
    transit_preference: str = Query(None, description="Transit routing options: fastest, fewest_transfers, least_walking"),
    intercity_rail_integration: bool = Query(False, description="Integrate intercity rail in transit routing"),
    lang: str = Query("en", description="Language: en or hi"),
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
        lang=preferred_lang
    )

@router.get("/lane-guidance")
async def get_lane_guidance(
    origin: str = Query(..., description="Origin coordinate string 'lat,lng'"),
    destination: str = Query(..., description="Destination coordinate string 'lat,lng'")
):
    # Returns lane-level guidance detail
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

