from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.pin import PinCreate, PinResponse, PinUpdate
from app.services.pin_service import PinService
from app.api.v1.deps import get_current_user
from app.db.models import User
from typing import List
from uuid import UUID

router = APIRouter()

@router.post("/", response_model=PinResponse, status_code=status.HTTP_201_CREATED)
async def create_pin(
    pin_in: PinCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = PinService(db)
    return await service.create_pin(current_user.id, pin_in)

@router.get("/", response_model=List[PinResponse])
async def list_pins(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = PinService(db)
    return await service.get_user_pins(current_user.id)

@router.put("/{pin_id}", response_model=PinResponse)
async def update_pin(
    pin_id: UUID, 
    pin_in: PinUpdate, 
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = PinService(db)
    success = await service.delete_pin(current_user.id, pin_id)
    if not success:
        raise HTTPException(status_code=404, detail="Pin not found")
    return None
