from fastapi import APIRouter, Query, Body
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.services.place_service import PlaceService

router = APIRouter()
service = PlaceService()

# Request schemas for POST endpoints
class AddressValidationRequest(BaseModel):
    address_lines: List[str]
    region_code: str = "US"
    locality: Optional[str] = None

class GeolocateRequest(BaseModel):
    cell_towers: Optional[List[Dict[str, Any]]] = None
    wifi_access_points: Optional[List[Dict[str, Any]]] = None

class PlaceAggregateRequest(BaseModel):
    lat: float
    lng: float
    radius: int = 1000
    place_types: Optional[List[str]] = None

@router.get("/nearby")
async def nearby_search(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(1000),
    type: Optional[str] = None
):
    return await service.search_nearby(lat, lng, radius, type)

@router.get("/details/{place_id}")
async def get_details(place_id: str):
    return await service.get_details(place_id)

@router.get("/autocomplete")
async def autocomplete(
    q: str = Query(...),
    lat: Optional[float] = None,
    lng: Optional[float] = None
):
    return await service.autocomplete(q, lat, lng)

@router.get("/search-text")
async def search_text(
    q: str = Query(...),
    lat: Optional[float] = None,
    lng: Optional[float] = None
):
    return await service.search_text(q, lat, lng)

@router.get("/geocode")
async def geocode(address: str = Query(...)):
    return await service.geocode(address)

@router.get("/reverse-geocode")
async def reverse_geocode(
    lat: float = Query(...),
    lng: float = Query(...)
):
    return await service.reverse_geocode(lat, lng)

@router.post("/validate-address")
async def validate_address(payload: AddressValidationRequest = Body(...)):
    return await service.validate_address(payload.address_lines, payload.region_code, payload.locality)

@router.post("/geolocate")
async def geolocate(payload: GeolocateRequest = Body(...)):
    return await service.geolocate(payload.cell_towers, payload.wifi_access_points)

@router.get("/timezone")
async def get_timezone(
    lat: float = Query(...),
    lng: float = Query(...),
    timestamp: Optional[int] = Query(None)
):
    return await service.get_timezone(lat, lng, timestamp)

@router.post("/aggregate")
async def aggregate_places(payload: PlaceAggregateRequest = Body(...)):
    return await service.aggregate_places(payload.lat, payload.lng, payload.radius, payload.place_types)

