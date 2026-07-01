from fastapi import APIRouter, Depends, Query, Body, status
from pydantic import BaseModel
from typing import Optional
from app.services.lifestyle_service import LifestyleService

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
