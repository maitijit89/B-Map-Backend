from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.shared.dependencies import get_current_user
from app.features.auth.models import User
from app.features.carpool.models import RideOffer, RideRequest, RideMatch
from app.features.carpool.service import CarpoolService

router = APIRouter()
carpool_service = CarpoolService()

@router.post("/offer", response_model=RideOffer)
async def create_ride_offer(data: RideOffer, current_user: User = Depends(get_current_user)):
    """Offer a ride to commuters"""
    return await carpool_service.create_offer(str(current_user.id), data)

@router.post("/request", response_model=RideRequest)
async def create_ride_request(data: RideRequest, current_user: User = Depends(get_current_user)):
    """Request a ride from commuters"""
    return await carpool_service.create_request(str(current_user.id), data)

@router.post("/matches", response_model=List[RideMatch])
async def find_ride_matches(request: RideRequest, current_user: User = Depends(get_current_user)):
    """Find matching ride offers for a request"""
    return await carpool_service.find_matches(request)
