from fastapi import APIRouter, Query, status
from app.features.environment.service import EnvironmentService, GovFeedService

router = APIRouter()
env_service = EnvironmentService()
gov_service = GovFeedService()

@router.get("/air-quality")
async def get_air_quality(
    lat: float = Query(...),
    lng: float = Query(...)
):
    return await env_service.get_air_quality(lat, lng)

@router.get("/pollen")
async def get_pollen(
    lat: float = Query(...),
    lng: float = Query(...),
    days: int = Query(1, description="Number of days for forecast")
):
    return await env_service.get_pollen(lat, lng, days)

@router.get("/weather")
async def get_weather(
    lat: float = Query(...),
    lng: float = Query(...),
    query_type: str = Query("current", enum=["current", "forecast_daily", "forecast_hourly", "history"])
):
    return await env_service.get_weather(lat, lng, query_type)

@router.get("/solar")
async def get_solar(
    lat: float = Query(...),
    lng: float = Query(...)
):
    return await env_service.get_solar_potential(lat, lng)

@router.get("/gov-feeds", status_code=status.HTTP_200_OK)
async def get_government_feeds(
    lat: float = Query(...),
    lng: float = Query(...)
):
    return await gov_service.get_government_feeds(lat, lng)
