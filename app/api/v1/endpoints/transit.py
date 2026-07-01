from fastapi import APIRouter, Query, status
from app.services.transit_service import TransitService

router = APIRouter()
service = TransitService()

@router.get("/live-bus", status_code=status.HTTP_200_OK)
async def get_live_bus(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(1500, description="Search radius in meters")
):
    return await service.get_live_transit(lat, lng, radius)
