from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

class PinBase(BaseModel):
    name: str
    description: Optional[str] = None
    lat: float
    lng: float

class PinCreate(PinBase):
    pass

class PinResponse(PinBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
        
class PinUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
