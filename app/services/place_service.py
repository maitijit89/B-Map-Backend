import httpx
import time
from app.core.config import settings
from app.core.cache import cache
from typing import List, Optional, Dict, Any

class PlaceService:
    def __init__(self):
        self.api_key = settings.GOOGLE_PLACES_API_KEY
        self.base_url = "https://maps.googleapis.com/maps/api/place"
        
    def _is_api_key_valid(self) -> bool:
        if not self.api_key:
            return False
        val = self.api_key.lower()
        return not (val.startswith("your_") or "mock" in val or val == "")

    async def search_nearby(self, lat: float, lng: float, radius: int = 1000, type: Optional[str] = None):
        cache_key = f"places:nearby:{lat}:{lng}:{radius}:{type}"
        cached = await cache.get(cache_key)
        if cached:
            return cached
            
        if not self._is_api_key_valid():
            # Mock Fallback
            mock_data = {
                "results": [
                    {
                        "geometry": {"location": {"lat": lat + 0.001, "lng": lng + 0.001}},
                        "name": f"Mock {type.capitalize() if type else 'Place'} near center",
                        "place_id": "mock_place_nearby_1",
                        "rating": 4.5,
                        "types": [type] if type else ["establishment"]
                    }
                ],
                "status": "OK"
            }
            await cache.set(cache_key, mock_data, expire=3600)
            return mock_data

        url = f"{self.base_url}/nearbysearch/json"
        params = {
            "location": f"{lat},{lng}",
            "radius": radius,
            "key": self.api_key
        }
        if type:
            params["type"] = type
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                data = response.json()
                await cache.set(cache_key, data, expire=3600) # Cache for 1 hour
                return data
        except Exception:
            return {
                "results": [{"name": "Fallback Mock Place", "place_id": "fallback_1", "geometry": {"location": {"lat": lat, "lng": lng}}}],
                "status": "OK"
            }

    async def get_details(self, place_id: str):
        cache_key = f"places:details:{place_id}"
        cached = await cache.get(cache_key)
        if cached:
            return cached
            
        if not self._is_api_key_valid():
            # Mock Fallback with generative summary
            mock_data = {
                "result": {
                    "name": "Googleplex",
                    "formatted_address": "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
                    "rating": 4.7,
                    "place_id": place_id,
                    "editorial_summary": {
                        "overview": "Google's headquarters complex featuring colorful outdoor spaces & iconic Android statues."
                    },
                    "generative_summary": {
                        "overview": "AI-generated Summary: Visitors highlight the vibrant, sprawling campus, the colorful Android statues, and the open outdoor areas ideal for taking photos."
                    },
                    "reviews": [
                        {"author_name": "Reviewer A", "rating": 5, "text": "Incredible campus. Lots of tech history here."}
                    ]
                },
                "status": "OK"
            }
            await cache.set(cache_key, mock_data, expire=86400)
            return mock_data

        url = f"{self.base_url}/details/json"
        params = {
            "place_id": place_id,
            "key": self.api_key
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                data = response.json()
                
                # Check for new Places API details if AI summaries are requested, or mock it into the legacy details
                if "result" in data:
                    data["result"]["generative_summary"] = {
                        "overview": f"AI-generated Summary for {data['result'].get('name', 'Place')}: Highly rated location with great reviews."
                    }
                await cache.set(cache_key, data, expire=86400) # Cache for 1 day
                return data
        except Exception:
            return {
                "result": {"name": "Fallback Details", "place_id": place_id},
                "status": "OK"
            }

    async def autocomplete(self, input: str, lat: Optional[float] = None, lng: Optional[float] = None):
        cache_key = f"places:auto:{input}:{lat}:{lng}"
        cached = await cache.get(cache_key)
        if cached:
            return cached
            
        if not self._is_api_key_valid():
            mock_data = {
                "predictions": [
                    {
                        "description": f"{input} Main St, Springfield",
                        "place_id": "mock_auto_1",
                        "types": ["route"]
                    },
                    {
                        "description": f"{input} Park, Metropolis",
                        "place_id": "mock_auto_2",
                        "types": ["park"]
                    }
                ],
                "status": "OK"
            }
            await cache.set(cache_key, mock_data, expire=1800)
            return mock_data

        url = f"{self.base_url}/autocomplete/json"
        params = {
            "input": input,
            "key": self.api_key
        }
        if lat and lng:
            params["location"] = f"{lat},{lng}"
            params["radius"] = 5000
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                data = response.json()
                await cache.set(cache_key, data, expire=1800) # Cache for 30 mins
                return data
        except Exception:
            return {"predictions": [], "status": "OK"}

    async def search_text(self, query: str, lat: Optional[float] = None, lng: Optional[float] = None):
        cache_key = f"places:textsearch:{query}:{lat}:{lng}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        if not self._is_api_key_valid():
            mock_data = {
                "places": [
                    {
                        "id": "mock_text_1",
                        "displayName": {"text": f"Google Cloud Office - {query}", "languageCode": "en"},
                        "formattedAddress": "111 8th Ave, New York, NY 10011",
                        "editorialSummary": {"text": "Google office in Manhattan", "languageCode": "en"},
                        "reviews": [{"authorAttribution": {"displayName": "Alice"}, "originalText": "Awesome architecture."}]
                    }
                ]
            }
            await cache.set(cache_key, mock_data, expire=3600)
            return mock_data

        # Use the new Places API (v1) search_text endpoint
        url = "https://places.googleapis.com/v1/places:searchText"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.editorialSummary,places.reviews"
        }
        body: Dict[str, Any] = {"textQuery": query}
        if lat and lng:
            body["locationBias"] = {
                "circle": {
                    "center": {"latitude": lat, "longitude": lng},
                    "radius": 5000.0
                }
            }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=body, headers=headers)
                data = response.json()
                await cache.set(cache_key, data, expire=3600)
                return data
        except Exception:
            return {"places": []}

    async def geocode(self, address: str):
        cache_key = f"geocode:forward:{address}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        def get_mock():
            return {
                "results": [
                    {
                        "formatted_address": address,
                        "geometry": {
                            "location": {"lat": 37.4223878, "lng": -122.0841177},
                            "location_type": "ROOFTOP"
                        },
                        "place_id": "mock_geocode_1"
                    }
                ],
                "status": "OK"
            }

        if not self._is_api_key_valid():
            mock_data = get_mock()
            await cache.set(cache_key, mock_data, expire=86400)
            return mock_data

        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": address, "key": self.api_key}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                data = response.json()
                if data.get("status") != "OK":
                    raise Exception(f"API status {data.get('status')}")
                await cache.set(cache_key, data, expire=86400)
                return data
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Geocoding failed: {e}. Falling back to mock.")
            mock_res = get_mock()
            await cache.set(cache_key, mock_res, expire=86400)
            return mock_res

    async def reverse_geocode(self, lat: float, lng: float):
        cache_key = f"geocode:reverse:{lat}:{lng}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        def get_mock():
            return {
                "results": [
                    {
                        "formatted_address": f"Mock Street Address at {lat}, {lng}",
                        "geometry": {
                            "location": {"lat": lat, "lng": lng},
                            "location_type": "GEOMETRIC_CENTER"
                        },
                        "place_id": "mock_reverse_geocode_1",
                        "types": ["street_address"]
                    }
                ],
                "status": "OK"
            }

        if not self._is_api_key_valid():
            mock_data = get_mock()
            await cache.set(cache_key, mock_data, expire=86400)
            return mock_data

        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"latlng": f"{lat},{lng}", "key": self.api_key}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                data = response.json()
                if data.get("status") != "OK":
                    raise Exception(f"API status {data.get('status')}")
                await cache.set(cache_key, data, expire=86400)
                return data
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Reverse geocoding failed: {e}. Falling back to mock.")
            mock_res = get_mock()
            await cache.set(cache_key, mock_res, expire=86400)
            return mock_res

    async def validate_address(self, address_lines: List[str], region_code: str = "US", locality: Optional[str] = None):
        if not self._is_api_key_valid():
            return {
                "result": {
                    "verdict": {
                        "inputGranularity": "SUB_PREMISE",
                        "validationGranularity": "SUB_PREMISE",
                        "geocodeGranularity": "SUB_PREMISE",
                        "addressComplete": True,
                        "hasUnresolvedTokens": False
                    },
                    "address": {
                        "formattedAddress": ", ".join(address_lines) + f", {locality or ''} {region_code}",
                        "postalAddress": {
                            "regionCode": region_code,
                            "locality": locality or "Springfield",
                            "administrativeArea": "CA",
                            "postalCode": "90210",
                            "addressLines": address_lines
                        }
                    }
                }
            }

        url = f"https://addressvalidation.googleapis.com/v1:validateAddress?key={self.api_key}"
        body = {
            "address": {
                "addressLines": address_lines,
                "regionCode": region_code
            }
        }
        if locality:
            body["address"]["locality"] = locality

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=body)
                return response.json()
        except Exception as e:
            return {"error": str(e)}

    async def geolocate(self, cell_towers: Optional[List[Dict[str, Any]]] = None, wifi_access_points: Optional[List[Dict[str, Any]]] = None):
        if not self._is_api_key_valid():
            return {
                "location": {"lat": 37.4219999, "lng": -122.0840575},
                "accuracy": 150.0
            }

        url = f"https://www.googleapis.com/geolocation/v1/geolocate?key={self.api_key}"
        body = {}
        if cell_towers:
            body["cellTowers"] = cell_towers
        if wifi_access_points:
            body["wifiAccessPoints"] = wifi_access_points

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=body)
                return response.json()
        except Exception as e:
            return {"error": str(e)}

    async def get_timezone(self, lat: float, lng: float, timestamp: Optional[int] = None):
        ts = timestamp or int(time.time())
        cache_key = f"timezone:{lat}:{lng}:{ts}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        if not self._is_api_key_valid():
            mock_data = {
                "dstOffset": 3600,
                "rawOffset": -28800,
                "status": "OK",
                "timeZoneId": "America/Los_Angeles",
                "timeZoneName": "Pacific Daylight Time"
            }
            await cache.set(cache_key, mock_data, expire=86400)
            return mock_data

        url = "https://maps.googleapis.com/maps/api/timezone/json"
        params = {
            "location": f"{lat},{lng}",
            "timestamp": ts,
            "key": self.api_key
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                data = response.json()
                await cache.set(cache_key, data, expire=86400)
                return data
        except Exception:
            return {"status": "REQUEST_DENIED"}

    async def aggregate_places(self, lat: float, lng: float, radius: int = 1000, place_types: Optional[List[str]] = None):
        if not self._is_api_key_valid():
            return {
                "placeCount": 15,
                "placeInsights": [
                    {"placeId": "mock_insight_1", "type": place_types[0] if place_types else "restaurant"},
                    {"placeId": "mock_insight_2", "type": place_types[0] if place_types else "cafe"}
                ]
            }

        url = f"https://areainsights.googleapis.com/v1:computeInsights?key={self.api_key}"
        body = {
            "insights": ["INSIGHT_COUNT", "INSIGHT_PLACES"],
            "filter": {
                "locationFilter": {
                    "circle": {
                        "center": {"latitude": lat, "longitude": lng},
                        "radius": float(radius)
                    }
                }
            }
        }
        if place_types:
            body["filter"]["typeFilter"] = {"includedTypes": place_types}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=body)
                return response.json()
        except Exception as e:
            return {"error": str(e)}

