from pydantic import Field
from typing import List, Dict, Any, Optional
from app.schemas.base import SecureBaseModel

# --- Rich POI Data Schemas ---
class RichPOIDetail(SecureBaseModel):
    poi_id: str = Field(..., max_length=100)
    name: str = Field(..., max_length=200)
    category: str = Field(..., max_length=50)
    rating: float = Field(..., ge=0.0, le=5.0)
    reviews_count: int = Field(..., ge=0)
    price_level: str = Field(..., max_length=10)
    address: str = Field(..., max_length=500)
    phone_number: str = Field(..., max_length=50)
    opening_hours: List[str] = []
    is_open_now: bool = True
    photos: List[str] = []
    amenities: List[str] = []
    floor_level: Optional[str] = Field(None, max_length=100)
    wheelchair_accessible: bool = True
    parking_available: bool = True
    popular_dishes_or_highlights: List[str] = []
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

class RichPOISearchResponse(SecureBaseModel):
    status: str = Field("OK", max_length=20)
    total_found: int = Field(..., ge=0)
    pois: List[RichPOIDetail]


# --- In-App Booking Schemas ---
class MovieBookingRequest(SecureBaseModel):
    cinema_id: str = Field(..., min_length=1, max_length=100)
    movie_title: str = Field(..., min_length=1, max_length=200)
    showtime: str = Field(..., min_length=1, max_length=100)
    hall_name: str = Field(..., min_length=1, max_length=100)
    seats: List[str] = Field(..., min_length=1, max_length=20)
    user_id: Optional[str] = Field("default_user", max_length=100)

class TravelTicketBookingRequest(SecureBaseModel):
    ticket_type: str = Field(..., max_length=50)
    carrier_or_line: str = Field(..., min_length=1, max_length=200)
    origin: str = Field(..., min_length=1, max_length=256)
    destination: str = Field(..., min_length=1, max_length=256)
    departure_time: str = Field(..., min_length=1, max_length=100)
    seat_class: str = Field(..., min_length=1, max_length=50)
    passenger_name: str = Field(..., min_length=1, max_length=150)
    passenger_id_passport: str = Field(..., min_length=1, max_length=100)

class UnifiedBookingResponse(SecureBaseModel):
    booking_id: str = Field(..., max_length=100)
    pnr_or_confirmation: str = Field(..., max_length=100)
    booking_type: str = Field(..., max_length=50)
    status: str = Field("CONFIRMED", max_length=50)
    title: str = Field(..., max_length=256)
    details: Dict[str, Any]
    total_amount_paid: float = Field(..., ge=0.0)
    currency: str = Field("INR", max_length=10)
    e_ticket_qr_code_url: str = Field(..., max_length=500)


# --- Personalized Recommendations Schemas ---
class RecommendationItem(SecureBaseModel):
    id: str = Field(..., max_length=100)
    title: str = Field(..., max_length=200)
    category: str = Field(..., max_length=50)
    match_score: float = Field(..., ge=0.0, le=1.0)
    time_of_day_fit: str = Field(..., max_length=50)
    reason: str = Field(..., max_length=500)
    photo_url: str = Field(..., max_length=500)
    rating: float = Field(..., ge=0.0, le=5.0)
    estimated_cost_inr: float = Field(..., ge=0.0)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

class PersonalizedRecommendationsResponse(SecureBaseModel):
    user_id: str = Field(..., max_length=100)
    time_of_day: str = Field(..., max_length=50)
    user_profile_tags: List[str] = []
    recommended_bundles: List[Dict[str, Any]] = []
    items: List[RecommendationItem] = []
