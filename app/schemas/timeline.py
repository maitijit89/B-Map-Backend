from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import List, Dict, Any

class LocationLog(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)

class TimelineResponse(BaseModel):
    id: UUID
    lat: float
    lng: float
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class TimelineStatsResponse(BaseModel):
    total_distance_km: float
    distinct_locations_count: int
    active_days_count: int
    most_visited_cluster: List[Dict[str, Any]]
