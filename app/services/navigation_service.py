import httpx
from app.core.config import settings
from typing import Optional

class NavigationService:
    def __init__(self):
        self.api_key = settings.GOOGLE_PLACES_API_KEY # Uses same key
        self.base_url = "https://maps.googleapis.com/maps/api/directions/json"

    async def get_directions(self, origin: str, destination: str, mode: str = "driving"):
        params = {
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "key": self.api_key
        }
        async with httpx.AsyncClient() as client:
            response = await client.get(self.base_url, params=params)
            return response.json()
