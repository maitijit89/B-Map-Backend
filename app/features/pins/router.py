from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.shared.dependencies import get_current_user
from app.features.auth.models import User
from app.features.pins.schemas import PinCreate, PinResponse, PinUpdate
from app.features.pins.service import PinService

router = APIRouter()

@router.post("/", response_model=PinResponse, status_code=status.HTTP_201_CREATED)
async def create_pin(
    pin_in: PinCreate, 
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = PinService(db)
    return await service.create_pin(current_user.id, pin_in)

@router.get("/", response_model=List[PinResponse])
async def list_pins(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = PinService(db)
    return await service.get_user_pins(current_user.id)

@router.put("/{pin_id}", response_model=PinResponse)
async def update_pin(
    pin_id: UUID, 
    pin_in: PinUpdate, 
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = PinService(db)
    pin = await service.update_pin(current_user.id, pin_id, pin_in)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    return pin

@router.delete("/{pin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pin(
    pin_id: UUID, 
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = PinService(db)
    success = await service.delete_pin(current_user.id, pin_id)
    if not success:
        raise HTTPException(status_code=404, detail="Pin not found")
    return None
