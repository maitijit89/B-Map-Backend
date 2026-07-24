import logging
import uuid
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class CabService:
    async def get_cabs_quotes(self, origin: str, destination: str) -> List[Dict[str, Any]]:
        quotes = await self.get_indian_auto_and_cab_comparison(origin, destination)
        return quotes.get("quotes", [])

    async def get_indian_auto_and_cab_comparison(self, origin: str, destination: str) -> Dict[str, Any]:
        """
        Hyper-local Indian ride-hailing & auto-rickshaw comparison across Namma Yatri, Govt Metered Auto, Shared Auto, Uber, Ola, and Rapido.
        """
        return {
            "origin": origin,
            "destination": destination,
            "distance_km": 5.2,
            "duration_mins": 14,
            "auto_rickshaws": [
                {
                    "provider": "Namma Yatri (Direct Driver)",
                    "type": "Auto-Rickshaw",
                    "fare_inr": 85.0,
                    "commission_type": "Zero Commission (Direct to Driver)",
                    "eta_mins": 2,
                    "deep_link": "nammayatri://ride?origin=" + origin + "&dest=" + destination
                },
                {
                    "provider": "Government Metered Auto",
                    "type": "Official Meter Fare",
                    "fare_inr": 80.0,
                    "note": "Base ₹30 for first 1.5 km + ₹15/km thereafter",
                    "eta_mins": 1
                },
                {
                    "provider": "Shared Auto Connector",
                    "type": "Fixed Last-Mile Route",
                    "fare_inr": 20.0,
                    "note": "Departs every 3 mins from nearest Metro station",
                    "eta_mins": 3
                }
            ],
            "quotes": [
                {
                    "provider": "Uber",
                    "service_type": "UberGo",
                    "price": 145.0,
                    "currency": "INR",
                    "eta_minutes": 3,
                    "duration_seconds": 1100,
                    "quote_id": "uber_quote_g1"
                },
                {
                    "provider": "Uber",
                    "service_type": "UberPremier",
                    "price": 195.0,
                    "currency": "INR",
                    "eta_minutes": 2,
                    "duration_seconds": 1100,
                    "quote_id": "uber_quote_p1"
                },
                {
                    "provider": "Ola",
                    "service_type": "OlaMini",
                    "price": 140.0,
                    "currency": "INR",
                    "eta_minutes": 4,
                    "duration_seconds": 1150,
                    "quote_id": "ola_quote_m1"
                },
                {
                    "provider": "Ola",
                    "service_type": "OlaBike",
                    "price": 60.0,
                    "currency": "INR",
                    "eta_minutes": 2,
                    "duration_seconds": 800,
                    "quote_id": "ola_quote_b1"
                },
                {
                    "provider": "Rapido",
                    "service_type": "Bike",
                    "price": 55.0,
                    "currency": "INR",
                    "eta_minutes": 1,
                    "duration_seconds": 780,
                    "quote_id": "rapido_quote_b1"
                },
                {
                    "provider": "Rapido",
                    "service_type": "Auto",
                    "price": 95.0,
                    "currency": "INR",
                    "eta_minutes": 3,
                    "duration_seconds": 950,
                    "quote_id": "rapido_quote_a1"
                }
            ]
        }

    async def book_cab(self, quote_id: str, provider: str, service_type: str) -> Dict[str, Any]:
        booking_ref = f"{provider[:3].upper()}-{str(uuid.uuid4())[:8].upper()}"
        return {
            "booking_reference": booking_ref,
            "provider": provider,
            "service_type": service_type,
            "status": "ACCEPTED",
            "driver_name": "Rajesh Kumar",
            "driver_phone": "+919876543210",
            "vehicle": {
                "model": "Suzuki Dzire" if service_type != "Bike" else "Hero Splendor",
                "license_plate": "DL-1CA-1234",
                "color": "White" if service_type != "Bike" else "Black"
            },
            "eta_minutes": 3,
            "otp": "4821",
            "message": f"Your booking with {provider} has been confirmed. Give OTP 4821 to the driver."
        }
