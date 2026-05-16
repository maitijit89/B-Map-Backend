from fastapi import APIRouter, Query
from app.services.navigation_service import NavigationService

router = APIRouter()
service = NavigationService()

@router.get("/directions")
async def get_directions(
    origin: str = Query(..., description="Origin location (lat,lng or place name)"),
    destination: str = Query(..., description="Destination location (lat,lng or place name)"),
    mode: str = Query("driving", enum=["driving", "walking", "bicycling", "transit"])
):
    return await service.get_directions(origin, destination, mode)
