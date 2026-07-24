from fastapi import APIRouter, Depends, Query, Body, status
from pydantic import BaseModel
from typing import Optional

from app.features.shortcuts.service import ShortcutService
from app.core.database import get_db
from app.shared.dependencies import get_current_user
from app.features.auth.models import User

router = APIRouter()
service = ShortcutService()

class SaveShortcutRequest(BaseModel):
    name: str
    address: str
    lat: float
    lng: float

@router.get("/", status_code=status.HTTP_200_OK)
async def get_shortcuts(
    current_location: Optional[str] = Query(None, description="Current coordinates 'lat,lng' for ETA calculations"),
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await service.get_shortcuts(str(current_user.id), current_location, db)

@router.post("/", status_code=status.HTTP_200_OK)
async def save_shortcut(
    payload: SaveShortcutRequest = Body(...),
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await service.create_or_update_shortcut(
        user_id=str(current_user.id),
        name=payload.name,
        address=payload.address,
        lat=payload.lat,
        lng=payload.lng,
        db=db
    )
