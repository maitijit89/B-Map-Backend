import httpx
from app.core.config import settings
from app.core.cache import cache
from typing import List, Optional

class PlaceService:
    def __init__(self):
        self.api_key = settings.GOOGLE_PLACES_API_KEY
        self.base_url = "https://maps.googleapis.com/maps/api/place"

    async def search_nearby(self, lat: float, lng: float, radius: int = 1000, type: Optional[str] = None):
        cache_key = f"places:nearby:{lat}:{lng}:{radius}:{type}"
        cached = await cache.get(cache_key)
        if cached:
            return cached
            
        url = f"{self.base_url}/nearbysearch/json"
        params = {
            "location": f"{lat},{lng}",
            "radius": radius,
            "key": self.api_key
        }
        if type:
            params["type"] = type
            
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            data = response.json()
            await cache.set(cache_key, data, expire=3600) # Cache for 1 hour
            return data

    async def get_details(self, place_id: str):
        cache_key = f"places:details:{place_id}"
        cached = await cache.get(cache_key)
        if cached:
            return cached
            
        url = f"{self.base_url}/details/json"
        params = {
            "place_id": place_id,
            "key": self.api_key
        }
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            data = response.json()
            await cache.set(cache_key, data, expire=86400) # Cache for 1 day
            return data

    async def autocomplete(self, input: str, lat: Optional[float] = None, lng: Optional[float] = None):
        cache_key = f"places:auto:{input}:{lat}:{lng}"
        cached = await cache.get(cache_key)
        if cached:
            return cached
            
        url = f"{self.base_url}/autocomplete/json"
        params = {
            "input": input,
            "key": self.api_key
        }
        if lat and lng:
            params["location"] = f"{lat},{lng}"
            params["radius"] = 5000
            
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            data = response.json()
            await cache.set(cache_key, data, expire=1800) # Cache for 30 mins
            return data
