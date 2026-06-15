from fastapi import APIRouter, Depends, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.session import get_db
from app.schemas.incident import IncidentCreate, IncidentResponse, IncidentQuery
from app.services.incident_service import IncidentService
from app.api.v1.deps import get_current_user
from app.db.models import User
from typing import List
from uuid import UUID

router = APIRouter()

@router.post("/", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
async def report_incident(
    incident_in: IncidentCreate, 
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = IncidentService(db)
    incident = await service.report_incident(current_user.id, incident_in)
    
    return IncidentResponse(
        id=incident.id,
        type=incident.type,
        severity=incident.severity,
        description=incident.description,
        lat=incident_in.lat,
        lng=incident_in.lng,
        reporter_id=incident.reporter_id,
        is_active=incident.is_active,
        upvotes=incident.upvotes,
        created_at=incident.created_at,
        expires_at=incident.expires_at
    )

@router.get("/nearby", response_model=List[IncidentResponse])
async def get_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(5000),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    service = IncidentService(db)
    query = IncidentQuery(lat=lat, lng=lng, radius=radius)
    return await service.get_nearby_incidents(query)
