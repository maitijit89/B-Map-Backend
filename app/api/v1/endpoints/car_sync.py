from fastapi import APIRouter, Depends, Query, Body, status
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.services.car_sync_service import CarSyncService
from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.db.models import User

router = APIRouter()
service = CarSyncService()

class SyncSessionRequest(BaseModel):
    device_id: str
    device_type: str = "car"  # "car", "watch", "mirror"
    active_route: Optional[Dict[str, Any]] = None
    favorites: Optional[List[str]] = None

@router.post("/session", status_code=status.HTTP_200_OK)
async def sync_device_session(
    payload: SyncSessionRequest = Body(...),
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await service.create_or_update_session(
        user_id=str(current_user.id),
        device_id=payload.device_id,
        device_type=payload.device_type,
        active_route=payload.active_route,
        favorites=payload.favorites,
        db=db
    )

@router.get("/mirror")
async def get_mirroring_status(
    device_id: str = Query(...)
):
    return await service.get_mirroring_status(device_id)

@router.get("/watch")
async def get_watch_sync(
    device_id: str = Query(...)
):
    return await service.get_watch_sync(device_id)
