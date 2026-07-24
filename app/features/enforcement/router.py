from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from app.shared.dependencies import get_current_user
from app.features.auth.models import User
from app.features.enforcement.models import Camera, RouteCheckRequest, EnforcementWarning
from app.features.enforcement.service import EnforcementService

router = APIRouter()
enforcement_service = EnforcementService()

@router.get("/nearby", response_model=List[Camera])
async def get_nearby_cameras(
    lat: float = Query(...), 
    lng: float = Query(...),
    radius: int = Query(5000)
):
    """Get nearby traffic cameras"""
    return await enforcement_service.get_nearby_cameras(lat, lng, radius)

@router.post("/route-check", response_model=List[EnforcementWarning])
async def check_route_for_cameras(data: RouteCheckRequest):
    """Check a route and current speed against upcoming cameras"""
    return await enforcement_service.check_route_for_cameras(data)
