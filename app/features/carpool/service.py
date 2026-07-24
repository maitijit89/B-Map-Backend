import uuid
import logging
from typing import List
from datetime import datetime, timedelta
from app.features.carpool.models import RideOffer, RideRequest, RideMatch

logger = logging.getLogger(__name__)

class CarpoolService:
    def __init__(self):
        # Mock database of active offers
        self.active_offers: List[RideOffer] = []

    async def create_offer(self, user_id: str, data: RideOffer) -> RideOffer:
        data.offer_id = str(uuid.uuid4())
        data.driver_id = user_id
        self.active_offers.append(data)
        logger.info(f"New ride offer created: {data.offer_id}")
        return data

    async def create_request(self, user_id: str, data: RideRequest) -> RideRequest:
        data.request_id = str(uuid.uuid4())
        data.passenger_id = user_id
        return data

    async def find_matches(self, request: RideRequest) -> List[RideMatch]:
        matches = []
        # Mock spatial intersection and time matching logic
        for offer in self.active_offers:
            if offer.seats_available >= request.seats_needed:
                # Check time window (mock: +/- 2 hours)
                # Ensure timezone awareness matches
                if offer.departure_time.tzinfo == request.desired_departure_time.tzinfo:
                    time_diff = abs((offer.departure_time - request.desired_departure_time).total_seconds())
                else:
                    # Strip tzinfo for simple comparison if mismatched
                    offer_dt = offer.departure_time.replace(tzinfo=None)
                    req_dt = request.desired_departure_time.replace(tzinfo=None)
                    time_diff = abs((offer_dt - req_dt).total_seconds())
                    
                if time_diff <= 7200:
                    matches.append(RideMatch(
                        offer_id=offer.offer_id,
                        driver_name="Verified Driver",
                        pickup_point=request.origin, # Assumes intersection near origin
                        dropoff_point=request.destination,
                        estimated_price=offer.price_per_seat * request.seats_needed,
                        departure_time=offer.departure_time
                    ))
        return matches
