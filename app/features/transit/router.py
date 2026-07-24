from fastapi import APIRouter, Query, status
from app.features.transit.service import TransitService

router = APIRouter()
service = TransitService()

@router.get("/live-bus", status_code=status.HTTP_200_OK)
async def get_live_bus(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(1500, description="Search radius in meters")
):
    return await service.get_live_transit(lat, lng, radius)

@router.get("/indian-suburban", status_code=status.HTTP_200_OK)
async def get_indian_suburban_transit(
    city: str = Query("delhi", description="City: delhi, mumbai, bengaluru, kolkata, chennai"),
    station: str = Query("Rajiv Chowk", description="Origin Metro/Suburban station"),
    destination: str = Query("HUDA City Centre", description="Destination Metro/Suburban station")
):
    """
    Returns carriage recommendations for exit stairs, door alignment, ladies special coach location, and fast vs slow line indicators for Indian suburban & metro networks.
    """
    return await service.get_indian_suburban_transit_intelligence(city, station, destination)
