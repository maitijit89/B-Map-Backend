from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from app.features.places.schemas import PlaceResponse

class UserListBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    is_public: bool = False

class UserListCreate(UserListBase):
    pass

class UserListResponse(UserListBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    places_count: int

    model_config = ConfigDict(from_attributes=True)

class UserListDetailResponse(UserListBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    places: List[PlaceResponse]

    model_config = ConfigDict(from_attributes=True)

class AddPlaceRequest(BaseModel):
    google_place_id: str
    name: str
    address: Optional[str] = None
    lat: float
    lng: float
