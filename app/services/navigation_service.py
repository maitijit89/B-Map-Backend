import httpx
import json
from app.core.config import settings
from app.core.cache import cache
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class NavigationService:
    def __init__(self):
        self.api_key = settings.GOOGLE_PLACES_API_KEY # Uses same key
        self.base_url = "https://maps.googleapis.com/maps/api/directions/json"

    def _is_api_key_valid(self) -> bool:
        if not self.api_key:
            return False
        val = self.api_key.lower()
        return not (val.startswith("your_") or "mock" in val or val == "")

    async def get_directions(self, origin: str, destination: str, mode: str = "driving"):
        cache_key = f"nav:dir:{origin}:{destination}:{mode}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        def get_mock():
            return {
                "routes": [
                    {
                        "legs": [
                            {
                                "distance": {"text": "5.2 km", "value": 5200},
                                "duration": {"text": "12 mins", "value": 720},
                                "end_address": destination,
                                "start_address": origin
                            }
                        ],
                        "summary": "Mock Route via Main St"
                    }
                ],
                "status": "OK"
            }

        if not self._is_api_key_valid():
            mock_data = get_mock()
            await cache.set(cache_key, mock_data, expire=3600)
            return mock_data

        params = {
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "key": self.api_key
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.base_url, params=params)
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                data = response.json()
                if data.get("status") not in ["OK", "ZERO_RESULTS"]:
                    raise Exception(f"API status {data.get('status')}")
                await cache.set(cache_key, data, expire=3600)
                return data
        except Exception as e:
            logger.warning(f"Directions query failed: {e}. Falling back to mock.")
            mock_data = get_mock()
            await cache.set(cache_key, mock_data, expire=3600)
            return mock_data

    async def compute_routes(self, origin: Dict[str, Any], destination: Dict[str, Any], travel_mode: str = "DRIVE", routing_preference: str = "TRAFFIC_AWARE"):
        body = {
            "origin": origin,
            "destination": destination,
            "travelMode": travel_mode,
            "routingPreference": routing_preference
        }
        cache_key = f"nav:comp_routes:{json.dumps(origin)}:{json.dumps(destination)}:{travel_mode}:{routing_preference}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        def get_mock():
            return {
                "routes": [
                    {
                        "duration": "720s",
                        "distanceMeters": 5200,
                        "polyline": {
                            "encodedPolyline": "mock_encoded_polyline_value"
                        },
                        "legs": [
                            {
                                "distanceMeters": 5200,
                                "duration": "720s"
                            }
                        ]
                    }
                ]
            }

        if not self._is_api_key_valid():
            mock_data = get_mock()
            await cache.set(cache_key, mock_data, expire=3600)
            return mock_data

        url = "https://routes.googleapis.com/v2:computeRoutes"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline,routes.legs"
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=body, headers=headers)
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                data = response.json()
                if "error" in data or "routes" not in data:
                    raise Exception("ComputeRoutes API Error")
                await cache.set(cache_key, data, expire=3600)
                return data
        except Exception as e:
            logger.warning(f"ComputeRoutes failed: {e}. Falling back to mock.")
            mock_data = get_mock()
            await cache.set(cache_key, mock_data, expire=3600)
            return mock_data

    async def get_distance_matrix(self, origins: List[str], destinations: List[str], mode: str = "driving"):
        origins_str = "|".join(origins)
        destinations_str = "|".join(destinations)
        cache_key = f"nav:dist_matrix:{origins_str}:{destinations_str}:{mode}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        def get_mock():
            rows = []
            for _ in origins:
                elements = []
                for _ in destinations:
                    elements.append({
                        "distance": {"text": "8.5 km", "value": 8500},
                        "duration": {"text": "15 mins", "value": 900},
                        "status": "OK"
                    })
                rows.append({"elements": elements})

            return {
                "destination_addresses": destinations,
                "origin_addresses": origins,
                "rows": rows,
                "status": "OK"
            }

        if not self._is_api_key_valid():
            mock_data = get_mock()
            await cache.set(cache_key, mock_data, expire=3600)
            return mock_data

        url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        params = {
            "origins": origins_str,
            "destinations": destinations_str,
            "mode": mode,
            "key": self.api_key
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                data = response.json()
                if data.get("status") not in ["OK", "ZERO_RESULTS"]:
                    raise Exception(f"API status {data.get('status')}")
                await cache.set(cache_key, data, expire=3600)
                return data
        except Exception as e:
            logger.warning(f"Distance matrix failed: {e}. Falling back to mock.")
            mock_data = get_mock()
            await cache.set(cache_key, mock_data, expire=3600)
            return mock_data

    async def optimize_routes(self, model: Dict[str, Any]):
        def get_mock():
            return {
                "routes": [
                    {
                        "vehicleIndex": 0,
                        "visits": [
                            {"shipmentIndex": 0, "startTime": "2026-06-13T09:00:00Z"},
                            {"shipmentIndex": 1, "startTime": "2026-06-13T09:30:00Z"}
                        ],
                        "transitions": [
                            {"travelDuration": "600s", "travelDistanceMeters": 4000}
                        ],
                        "metrics": {
                            "totalTravelDuration": "1200s",
                            "totalTravelDistanceMeters": 8000
                        }
                    }
                ],
                "metrics": {
                    "totalTravelDuration": "1200s",
                    "totalTravelDistanceMeters": 8000
                }
            }

        if not self._is_api_key_valid():
            return get_mock()

        project_id = "b-map"
        url = f"https://routeoptimization.googleapis.com/v1/projects/{project_id}:optimizeTours?key={self.api_key}"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=model)
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                data = response.json()
                if "error" in data:
                    raise Exception("RouteOptimization API Error")
                return data
        except Exception as e:
            logger.warning(f"Route optimization failed: {e}. Falling back to mock.")
            return get_mock()

    async def snap_to_roads(self, path: str):
        cache_key = f"nav:snap_roads:{path}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        def get_mock():
            return {
                "snappedPoints": [
                    {
                        "location": {"latitude": 37.422, "longitude": -122.084},
                        "originalIndex": 0,
                        "placeId": "mock_road_place_1"
                    }
                ]
            }

        if not self._is_api_key_valid():
            mock_data = get_mock()
            await cache.set(cache_key, mock_data, expire=86400)
            return mock_data

        url = "https://roads.googleapis.com/v1/snapToRoads"
        params = {
            "path": path,
            "interpolate": "true",
            "key": self.api_key
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                data = response.json()
                if "error" in data:
                    raise Exception("Roads API Error")
                await cache.set(cache_key, data, expire=86400)
                return data
        except Exception as e:
            logger.warning(f"Snap to roads failed: {e}. Falling back to mock.")
            mock_data = get_mock()
            await cache.set(cache_key, mock_data, expire=86400)
            return mock_data

    async def get_speed_limits(self, path: str):
        cache_key = f"nav:speed_limits:{path}"
        cached = await cache.get(cache_key)
        if cached:
            return cached

        def get_mock():
            return {
                "speedLimits": [
                    {
                        "placeId": "mock_road_place_1",
                        "speedLimit": 65,
                        "units": "KPH"
                    }
                ]
            }

        if not self._is_api_key_valid():
            mock_data = get_mock()
            await cache.set(cache_key, mock_data, expire=86400)
            return mock_data

        url = "https://roads.googleapis.com/v1/speedLimits"
        params = {
            "path": path,
            "key": self.api_key
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                data = response.json()
                if "error" in data:
                    raise Exception("Speed limits API Error")
                await cache.set(cache_key, data, expire=86400)
                return data
        except Exception as e:
            logger.warning(f"Speed limits query failed: {e}. Falling back to mock.")
            mock_data = get_mock()
            await cache.set(cache_key, mock_data, expire=86400)
            return mock_data
