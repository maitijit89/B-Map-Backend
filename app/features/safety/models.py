from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class EmergencyContact(BaseModel):
    name: str
    phone_number: str
    relation: Optional[str] = None

class LiveSessionCreate(BaseModel):
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    estimated_arrival_time: Optional[datetime] = None

class LiveSessionResponse(BaseModel):
    session_id: str
    shareable_url: str
    status: str

class SOSRequest(BaseModel):
    lat: float
    lng: float
    message: Optional[str] = "I need help. Here is my last known location."
