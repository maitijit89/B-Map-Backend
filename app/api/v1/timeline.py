from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.session import get_db
from app.schemas.timeline import LocationLog, TimelineResponse, TimelineStatsResponse
from app.services.timeline_service import TimelineService
from app.api.v1.deps import get_current_user
from app.db.models import User
from typing import List, Optional
from datetime import datetime

router = APIRouter()

@router.post("/", response_model=TimelineResponse, status_code=status.HTTP_201_CREATED)
async def log_location(
    location_in: LocationLog,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = TimelineService(db)
    return await service.log_location(current_user.id, location_in)

@router.get("/", response_model=List[TimelineResponse])
async def get_timeline(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = TimelineService(db)
    return await service.get_timeline(current_user.id, start_date, end_date)

@router.get("/stats", response_model=TimelineStatsResponse)
async def get_timeline_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = TimelineService(db)
    return await service.get_timeline_stats(current_user.id)
