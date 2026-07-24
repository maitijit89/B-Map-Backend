from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from app.features.incidents.models import IncidentType, IncidentSeverity

class IncidentBase(BaseModel):
    type: IncidentType
    severity: IncidentSeverity = IncidentSeverity.MEDIUM
    description: Optional[str] = None
    lat: float
    lng: float

class IncidentCreate(IncidentBase):
    pass

class IncidentResponse(BaseModel):
    id: UUID
    type: IncidentType
    severity: IncidentSeverity
    description: Optional[str]
    lat: float
    lng: float
    reporter_id: Optional[UUID]
    is_active: bool
    upvotes: int
    created_at: datetime
    expires_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)

class IncidentQuery(BaseModel):
    lat: float
    lng: float
    radius: float = Field(default=5000, description="Radius in meters")
