from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.shared.dependencies import get_current_user, get_current_user_optional
from app.features.auth.models import User
from app.features.user_lists.schemas import UserListCreate, UserListResponse, UserListDetailResponse, AddPlaceRequest
from app.features.user_lists.service import UserListService

router = APIRouter()

@router.post("/", response_model=UserListResponse, status_code=status.HTTP_201_CREATED)
async def create_list(
    list_in: UserListCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = UserListService(db)
    return await service.create_list(current_user.id, list_in)

@router.get("/", response_model=List[UserListResponse])
async def get_user_lists(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = UserListService(db)
    return await service.get_user_lists(current_user.id)

@router.post("/{list_id}/places", status_code=status.HTTP_200_OK)
async def add_place_to_list(
    list_id: UUID,
    req: AddPlaceRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = UserListService(db)
    success = await service.add_place_to_list(current_user.id, list_id, req)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found or not authorized to add places"
        )
    return {"status": "success"}

@router.delete("/{list_id}/places/{place_id}", status_code=status.HTTP_200_OK)
async def remove_place_from_list(
    list_id: UUID,
    place_id: UUID,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = UserListService(db)
    success = await service.remove_place_from_list(current_user.id, list_id, place_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List or place not found or not authorized"
        )
    return {"status": "success"}

@router.get("/{list_id}", response_model=UserListDetailResponse)
async def get_list_details(
    list_id: UUID,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    service = UserListService(db)
    user_id = current_user.id if current_user else None
    
    details = await service.get_list_details(user_id, list_id)
    if not details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="List not found or private access denied"
        )
    return details
