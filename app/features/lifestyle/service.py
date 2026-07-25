import logging
from typing import Dict, Any, List, Optional
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

    async def book_movie_tickets(
        self,
        cinema_id: str,
        movie_title: str,
        showtime: str,
        hall_name: str,
        seats: List[str],
        user_id: str = "default_user"
    ) -> Dict[str, Any]:
        """
        In-App Booking: Directly purchases movie tickets within the app with seat selection & e-ticket QR code.
        """
        booking_id = f"movie_bk_{str(uuid.uuid4())[:8]}"
        pnr = f"CINEMA-{str(uuid.uuid4())[:6].upper()}"
        ticket_cost = len(seats) * 350.0
        return {
            "booking_id": booking_id,
            "pnr_or_confirmation": pnr,
            "booking_type": "MOVIE",
            "status": "CONFIRMED",
            "title": f"Movie Ticket: {movie_title}",
            "details": {
                "cinema_id": cinema_id,
                "movie_title": movie_title,
                "showtime": showtime,
                "hall_name": hall_name,
                "seats": seats,
                "seat_count": len(seats)
            },
            "total_amount_paid": ticket_cost,
            "currency": "INR",
            "e_ticket_qr_code_url": f"https://api.bmap.io/v1/tickets/qr/{pnr}.png"
        }

    async def book_travel_tickets(
        self,
        ticket_type: str,
        carrier_or_line: str,
        origin: str,
        destination: str,
        departure_time: str,
        seat_class: str,
        passenger_name: str,
        passenger_id_passport: str
    ) -> Dict[str, Any]:
        """
        In-App Booking: Directly books airline and train tickets within the app with instant PNR issuance.
        """
        b_type = ticket_type.upper()
        pnr_prefix = "AIR" if b_type == "AIRLINE" else "RAIL"
        pnr = f"{pnr_prefix}-{str(uuid.uuid4())[:8].upper()}"
        booking_id = f"travel_bk_{str(uuid.uuid4())[:8]}"
        amount = 4500.0 if b_type == "AIRLINE" else 1450.0

        return {
            "booking_id": booking_id,
            "pnr_or_confirmation": pnr,
            "booking_type": f"{b_type}_TICKET",
            "status": "CONFIRMED",
            "title": f"{b_type.capitalize()} Ticket: {carrier_or_line}",
            "details": {
                "carrier_or_line": carrier_or_line,
                "origin": origin,
                "destination": destination,
                "departure_time": departure_time,
                "seat_class": seat_class,
                "passenger_name": passenger_name,
                "passenger_id_passport": passenger_id_passport
            },
            "total_amount_paid": amount,
            "currency": "INR",
            "e_ticket_qr_code_url": f"https://api.bmap.io/v1/tickets/qr/{pnr}.png"
        }

    async def get_personalized_recommendations(
        self,
        user_id: str = "default_user",
        lat: float = 22.5726,
        lng: float = 88.3639,
        time_of_day: Optional[str] = "EVENING",
        user_interests: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Personalized Recommendations: Pushes high-quality travel plans, dining, and entertainment based on user preferences and time of day.
        """
        tod = (time_of_day or "EVENING").upper()
        interests = user_interests or ["fine_dining", "heritage_sites", "cinema", "coffee"]
        
        items = [
            {
                "id": "rec_01",
                "title": "Banyan Tree Rooftop Dinner & Mocktails",
                "category": "DINING",
                "match_score": 0.98,
                "time_of_day_fit": tod,
                "reason": "Popular evening dining match based on your preference for fine dining & rooftop views.",
                "photo_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800",
                "rating": 4.9,
                "estimated_cost_inr": 1800.0,
                "latitude": lat + 0.001,
                "longitude": lng + 0.002
            },
            {
                "id": "rec_02",
                "title": "IMAX 3D Evening Blockbuster Experience",
                "category": "ENTERTAINMENT",
                "match_score": 0.94,
                "time_of_day_fit": tod,
                "reason": "Trending evening cinema entertainment near your location.",
                "photo_url": "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=800",
                "rating": 4.7,
                "estimated_cost_inr": 450.0,
                "latitude": lat - 0.002,
                "longitude": lng + 0.003
            },
            {
                "id": "rec_03",
                "title": "Victoria Memorial Sunset Walk & Light Show",
                "category": "ATTRACTION",
                "match_score": 0.91,
                "time_of_day_fit": tod,
                "reason": "Iconic heritage site featuring an evening light & sound show.",
                "photo_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800",
                "rating": 4.8,
                "estimated_cost_inr": 100.0,
                "latitude": lat + 0.003,
                "longitude": lng - 0.002
            }
        ]

        bundles = [
            {
                "bundle_title": "Ultimate Evening Out in Kolkata",
                "items_included": ["Victoria Memorial Sunset Walk", "Banyan Tree Rooftop Dinner", "IMAX Night Show"],
                "total_estimated_duration": "5 hours",
                "recommended_start_time": "05:30 PM",
                "total_cost_inr": 2350.0
            }
        ]

        return {
            "user_id": user_id,
            "time_of_day": tod,
            "user_profile_tags": interests,
            "recommended_bundles": bundles,
            "items": items
        }

