import logging
import uuid
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class CabService:
    async def get_cabs_quotes(self, origin: str, destination: str) -> List[Dict[str, Any]]:
        """
        Fetch dynamic pricing and ETAs for Ola, Uber, and Rapido.
        """
        # Mocks pricing and ETAs
        return [
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

    async def book_cab(self, quote_id: str, provider: str, service_type: str) -> Dict[str, Any]:
        """
        Request ride booking from the selected provider.
        """
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
            "message": f"Your booking with {provider} has been confirmed. Give OTP {4821} to the driver."
        }
