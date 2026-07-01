from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.session import get_db
from app.schemas.review import ReviewCreate, ReviewResponse
from app.services.review_service import ReviewService
from app.api.v1.deps import get_current_user
from app.db.models import User
from typing import List, Optional
from uuid import UUID

router = APIRouter()

@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def add_review(
    review_in: ReviewCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ReviewService(db)
    return await service.add_review(current_user.id, review_in)

@router.get("/", response_model=List[ReviewResponse])
async def get_reviews(
    placeId: Optional[str] = Query(None, alias="placeId"),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    if not placeId:
        return []
    service = ReviewService(db)
    return await service.get_place_reviews(placeId)

@router.get("/me", response_model=List[ReviewResponse])
async def get_my_reviews(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ReviewService(db)
    return await service.get_user_reviews(current_user.id)

@router.get("/place/{google_place_id}", response_model=List[ReviewResponse])
async def get_place_reviews(
    google_place_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    service = ReviewService(db)
    return await service.get_place_reviews(google_place_id)

@router.delete("/{review_id}", status_code=status.HTTP_200_OK)
async def delete_review(
    review_id: UUID,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ReviewService(db)
    success = await service.delete_review(current_user.id, review_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found or not authorized to delete"
        )
    return {"status": "success"}
