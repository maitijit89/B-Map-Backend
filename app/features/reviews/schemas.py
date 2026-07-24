from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

class ReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating between 1 and 5")
    comment: Optional[str] = Field(None, max_length=1000)

class ReviewCreate(ReviewBase):
    google_place_id: str = Field(..., description="Google Place ID of the rated place")
    place_name: str = Field(..., description="Name of the place")
    place_address: Optional[str] = Field(None, description="Address of the place")
    lat: float = Field(..., description="Latitude of the place")
    lng: float = Field(..., description="Longitude of the place")

class ReviewResponse(ReviewBase):
    id: UUID
    user_id: UUID
    place_id: UUID
    created_at: datetime
    reviewer_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
