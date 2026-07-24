from pydantic import BaseModel, Field
from typing import List, Optional

class Camera(BaseModel):
    id: str
    lat: float
    lng: float
    type: str = Field(..., description="SPEED, RED_LIGHT, BUS_LANE")
    speed_limit: Optional[int] = None

class RouteCheckRequest(BaseModel):
    route_polyline: str
    current_lat: float
    current_lng: float
    current_speed_kph: float

class EnforcementWarning(BaseModel):
    camera_id: str
    camera_type: str
    distance_meters: int
    speed_limit: Optional[int] = None
    is_speeding: bool
