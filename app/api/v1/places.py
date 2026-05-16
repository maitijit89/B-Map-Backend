from fastapi import APIRouter, Query, Optional
from app.services.place_service import PlaceService

router = APIRouter()
service = PlaceService()

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
