from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.session import get_db
from app.services.offline_service import OfflineService
from typing import Dict, Any

router = APIRouter()

@router.get("/cache", status_code=status.HTTP_200_OK)
async def get_offline_cache(
    lat_min: float = Query(..., ge=-90.0, le=90.0),
    lng_min: float = Query(..., ge=-180.0, le=180.0),
    lat_max: float = Query(..., ge=-90.0, le=90.0),
    lng_max: float = Query(..., ge=-180.0, le=180.0),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    service = OfflineService(db)
    return await service.cache_region_data(lat_min, lng_min, lat_max, lng_max)
