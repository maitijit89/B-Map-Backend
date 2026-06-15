from fastapi import APIRouter, Query
from app.services.environment_service import EnvironmentService

router = APIRouter()
service = EnvironmentService()

@router.get("/air-quality")
async def get_air_quality(
    lat: float = Query(...),
    lng: float = Query(...)
):
    return await service.get_air_quality(lat, lng)

@router.get("/pollen")
async def get_pollen(
    lat: float = Query(...),
    lng: float = Query(...),
    days: int = Query(1, description="Number of days for forecast")
):
    return await service.get_pollen(lat, lng, days)

@router.get("/weather")
async def get_weather(
    lat: float = Query(...),
    lng: float = Query(...),
    query_type: str = Query("current", enum=["current", "forecast_daily", "forecast_hourly", "history"])
):
    return await service.get_weather(lat, lng, query_type)

@router.get("/solar")
async def get_solar(
    lat: float = Query(...),
    lng: float = Query(...)
):
    return await service.get_solar_potential(lat, lng)
