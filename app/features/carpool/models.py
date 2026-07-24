from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class RoutePolyline(BaseModel):
    # Simplified representation for API
    encoded_polyline: str

class RideOffer(BaseModel):
    offer_id: Optional[str] = None
    driver_id: Optional[str] = None
    origin: str
    destination: str
    route: RoutePolyline
    departure_time: datetime
    seats_available: int
    price_per_seat: float

class RideRequest(BaseModel):
    request_id: Optional[str] = None
    passenger_id: Optional[str] = None
    origin: str
    destination: str
    desired_departure_time: datetime
    seats_needed: int

class RideMatch(BaseModel):
    offer_id: str
    driver_name: str
    pickup_point: str
    dropoff_point: str
    estimated_price: float
    departure_time: datetime
