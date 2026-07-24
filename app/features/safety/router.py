from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.shared.dependencies import get_current_user
from app.features.auth.models import User
from app.features.safety.models import EmergencyContact, LiveSessionCreate, LiveSessionResponse, SOSRequest
from app.features.safety.service import SafetyService

router = APIRouter()
safety_service = SafetyService()

@router.get("/contacts", response_model=List[EmergencyContact])
async def get_emergency_contacts(current_user: User = Depends(get_current_user)):
    """Get the user's emergency contacts"""
    return await safety_service.get_emergency_contacts(str(current_user.id))

@router.post("/live/start", response_model=LiveSessionResponse)
async def start_live_tracking(data: LiveSessionCreate, current_user: User = Depends(get_current_user)):
    """Start a live tracking session and generate a shareable link"""
    return await safety_service.start_live_tracking(str(current_user.id), data)

@router.post("/sos")
async def trigger_sos(data: SOSRequest, current_user: User = Depends(get_current_user)):
    """Trigger an emergency SOS alert to all saved contacts"""
    result = await safety_service.trigger_sos(str(current_user.id), data)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result
