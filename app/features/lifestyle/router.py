from fastapi import APIRouter, Depends, Query, Body, status
from pydantic import BaseModel
from typing import Optional
from app.features.lifestyle.service import LifestyleService

router = APIRouter()
service = LifestyleService()

class BookRideRequest(BaseModel):
    provider: str
    service_type: str
    origin: str
    destination: str

class BookHotelRequest(BaseModel):
    hotel_id: str
    check_in: str
    check_out: str
    room_type: str

@router.get("/ride-hailing/compare")
async def compare_ride_hailing(
    origin: str = Query(...),
    destination: str = Query(...)
):
    return await service.compare_ride_hailing(origin, destination)

@router.post("/ride-hailing/book", status_code=status.HTTP_201_CREATED)
async def book_ride(payload: BookRideRequest = Body(...)):
    return await service.book_ride(
        provider=payload.provider,
        service_type=payload.service_type,
        origin=payload.origin,
        destination=payload.destination
    )

@router.get("/partner/restaurants")
async def get_restaurants(
    query: str = Query(...),
    lat: float = Query(...),
    lng: float = Query(...)
):
    return await service.search_restaurants_tripcom(query, lat, lng)

@router.post("/partner/hotels/book", status_code=status.HTTP_201_CREATED)
async def book_hotel(payload: BookHotelRequest = Body(...)):
    return await service.book_hotel_tripcom(
        hotel_id=payload.hotel_id,
        check_in=payload.check_in,
        check_out=payload.check_out,
        room_type=payload.room_type
    )

@router.get("/nearby")
async def get_nearby_amenities(
    lat: float = Query(...),
    lng: float = Query(...),
    type: str = Query(..., description="Amenities: charging_station, atm, restroom, bike_sharing")
):
    return await service.get_nearby_amenities(lat, lng, type)

from typing import List
from app.schemas.lifestyle import (
    MovieBookingRequest,
    TravelTicketBookingRequest,
    UnifiedBookingResponse,
    PersonalizedRecommendationsResponse
)

@router.post("/booking/movie", response_model=UnifiedBookingResponse, status_code=status.HTTP_201_CREATED)
async def book_movie_tickets(payload: MovieBookingRequest = Body(...)):
    """
    In-App Booking: Book movie tickets directly within the app with cinema hall & seat selection.
    """
    return await service.book_movie_tickets(
        cinema_id=payload.cinema_id,
        movie_title=payload.movie_title,
        showtime=payload.showtime,
        hall_name=payload.hall_name,
        seats=payload.seats,
        user_id=payload.user_id or "default_user"
    )

@router.post("/booking/travel-tickets", response_model=UnifiedBookingResponse, status_code=status.HTTP_201_CREATED)
async def book_travel_tickets(payload: TravelTicketBookingRequest = Body(...)):
    """
    In-App Booking: Book airline and train tickets directly within the app with instant PNR confirmation.
    """
    return await service.book_travel_tickets(
        ticket_type=payload.ticket_type,
        carrier_or_line=payload.carrier_or_line,
        origin=payload.origin,
        destination=payload.destination,
        departure_time=payload.departure_time,
        seat_class=payload.seat_class,
        passenger_name=payload.passenger_name,
        passenger_id_passport=payload.passenger_id_passport
    )

@router.get("/recommendations", response_model=PersonalizedRecommendationsResponse)
async def get_personalized_recommendations(
    user_id: str = Query("default_user", description="User ID"),
    lat: float = Query(22.5726, description="Latitude"),
    lng: float = Query(88.3639, description="Longitude"),
    time_of_day: Optional[str] = Query("EVENING", description="Time of day: MORNING, AFTERNOON, EVENING, LATE_NIGHT"),
    user_interests: Optional[List[str]] = Query(None, description="User interest tags e.g. fine_dining, cinema, heritage_sites")
):
    """
    Personalized Recommendations: Pushes high-quality travel plans, dining, and entertainment based on user preferences & time of day.
    """
    return await service.get_personalized_recommendations(
        user_id=user_id,
        lat=lat,
        lng=lng,
        time_of_day=time_of_day,
        user_interests=user_interests
    )

