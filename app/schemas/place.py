from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

class PlaceResponse(BaseModel):
    id: UUID
    google_place_id: str
    name: str
    address: Optional[str] = None
    lat: float
    lng: float
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
