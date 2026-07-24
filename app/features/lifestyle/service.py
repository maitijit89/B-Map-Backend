import logging
from typing import Dict, Any, List
import uuid

logger = logging.getLogger(__name__)

class LifestyleService:
    async def compare_ride_hailing(self, origin: str, destination: str) -> List[Dict[str, Any]]:
        return [
            {
                "provider": "DiDi",
                "service_type": "Express",
                "price": 28.50,
                "currency": "CNY",
                "eta_minutes": 5,
                "duration_seconds": 960,
                "booking_deep_link": "didi://booking?origin=" + origin + "&destination=" + destination
            },
            {
                "provider": "CaoCao",
                "service_type": "Premium EV",
                "price": 32.00,
                "currency": "CNY",
                "eta_minutes": 3,
                "duration_seconds": 900,
                "booking_deep_link": "caocao://booking?origin=" + origin + "&destination=" + destination
            },
            {
                "provider": "Local Taxi",
                "service_type": "Standard Metered",
                "price": 26.00,
                "currency": "CNY",
                "eta_minutes": 8,
                "duration_seconds": 1020,
                "booking_deep_link": "taxi://hail?origin=" + origin + "&destination=" + destination
            }
        ]

    async def book_ride(self, provider: str, service_type: str, origin: str, destination: str) -> Dict[str, Any]:
        booking_id = str(uuid.uuid4())
        return {
            "booking_id": booking_id,
            "provider": provider,
            "service_type": service_type,
            "status": "CONFIRMED",
            "eta_minutes": 4,
            "driver_name": "Mr. Wang",
            "license_plate": "京A-D8888",
            "vehicle_model": "BYD Qin Plus EV",
            "message": f"Your ride with {provider} has been requested successfully."
        }

    async def search_restaurants_tripcom(self, query: str, lat: float, lng: float) -> List[Dict[str, Any]]:
        return [
            {
                "name": "Trip.com Partner: Roast Duck Court",
                "rating": 4.8,
                "reviews_count": 1240,
                "cuisine": "Beijing Duck",
                "price_range": "$$$",
                "photos": [
                    "https://images.unsplash.com/photo-1598515214211-89d3e73ae83b?auto=format&fit=crop&w=600"
                ],
                "menu": [
                    {"item": "Signature Peking Duck", "price": 188.0},
                    {"item": "Duck Bone Soup", "price": 38.0}
                ],
                "partner_logo": "Trip.com Verified Partner"
            },
            {
                "name": "Sichuan Hotpot Oasis",
                "rating": 4.6,
                "reviews_count": 890,
                "cuisine": "Sichuan Hotpot",
                "price_range": "$$",
                "photos": [
                    "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600"
                ],
                "menu": [
                    {"item": "Spicy Broth Base", "price": 48.0},
                    {"item": "Premium Sliced Beef", "price": 68.0}
                ],
                "partner_logo": "Trip.com Verified Partner"
            }
        ]

    async def book_hotel_tripcom(self, hotel_id: str, check_in: str, check_out: str, room_type: str) -> Dict[str, Any]:
        return {
            "booking_reference": "TRIP-" + str(uuid.uuid4())[:8].upper(),
            "hotel_id": hotel_id,
            "check_in": check_in,
            "check_out": check_out,
            "room_type": room_type,
            "status": "RESERVED",
            "total_price": 580.0,
            "currency": "CNY",
            "cancellation_policy": "Free cancellation before check-in date",
            "partner": "Trip.com Booking Engine"
        }

    async def get_nearby_amenities(self, lat: float, lng: float, amenity_type: str) -> List[Dict[str, Any]]:
        amenity_type = amenity_type.lower()
        if amenity_type == "charging_station":
            return [
                {"name": "State Grid EV Station", "distance_meters": 150, "lat": lat + 0.001, "lng": lng + 0.001, "connectors_available": 6},
                {"name": "Telsa Supercharger Plaza", "distance_meters": 450, "lat": lat - 0.002, "lng": lng + 0.003, "connectors_available": 4}
            ]
        elif amenity_type == "atm":
            return [
                {"name": "Industrial and Commercial Bank ATM", "distance_meters": 80, "lat": lat + 0.0005, "lng": lng - 0.0002},
                {"name": "Bank of China Branch ATM", "distance_meters": 220, "lat": lat + 0.0015, "lng": lng + 0.0012}
            ]
        elif amenity_type == "restroom":
            return [
                {"name": "Public Toilet No. 42", "distance_meters": 300, "lat": lat - 0.0015, "lng": lng - 0.001},
                {"name": "Station Restrooms (East Exit)", "distance_meters": 520, "lat": lat + 0.004, "lng": lng}
            ]
        elif amenity_type in ["bike_sharing", "bike"]:
            return [
                {"name": "Meituan Bike Stand", "distance_meters": 45, "lat": lat + 0.0002, "lng": lng + 0.0001, "bikes_available": 12},
                {"name": "Hello Bike Stand", "distance_meters": 95, "lat": lat - 0.0004, "lng": lng - 0.0003, "bikes_available": 7}
            ]
        else:
            return []
