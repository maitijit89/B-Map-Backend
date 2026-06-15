from fastapi import APIRouter, Query, Body
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.navigation_service import NavigationService

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
    mode: str = Query("driving", enum=["driving", "walking", "bicycling", "transit"])
):
    return await service.get_directions(origin, destination, mode)

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

