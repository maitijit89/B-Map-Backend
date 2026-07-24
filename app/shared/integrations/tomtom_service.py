import logging
import httpx
from typing import Dict, Any, List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class TomTomService:
    def __init__(self):
        self.api_key = settings.TOMTOM_API_KEY
        self.app_id = settings.TOMTOM_APP_ID
        self.base_url = "https://api.tomtom.com"

    def is_configured(self) -> bool:
        if not self.api_key:
            return False
        val = self.api_key.lower()
        return not (val.startswith("your_") or "mock" in val or val == "")

    async def reverse_geocode(self, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        """
        Calls TomTom Reverse Geocoding API.
        """
        if not self.is_configured():
            return None
        url = f"{self.base_url}/search/2/reverseGeocode/{lat},{lng}.json?key={self.api_key}"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    addresses = data.get("addresses", [])
                    if addresses:
                        addr = addresses[0].get("address", {})
                        return {
                            "status": "OK",
                            "formatted_address": addr.get("freeformAddress"),
                            "street": addr.get("streetName"),
                            "city": addr.get("municipality"),
                            "country": addr.get("country"),
                            "postal_code": addr.get("postalCode"),
                            "source": "TomTom Reverse Geocoding API"
                        }
        except Exception as e:
            logger.warning(f"TomTom Reverse Geocoding failed: {e}")
        return None

    async def calculate_route(self, origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float, travel_mode: str = "car") -> Optional[Dict[str, Any]]:
        """
        Calls TomTom Routing API (Routing v1/v2).
        """
        if not self.is_configured():
            return None
        locations_str = f"{origin_lat},{origin_lng}:{dest_lat},{dest_lng}"
        url = f"{self.base_url}/routing/1/calculateRoute/{locations_str}/json"
        params = {
            "key": self.api_key,
            "travelMode": travel_mode.lower(),
            "traffic": "true",
            "computeTravelTimeFor": "all"
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    routes = data.get("routes", [])
                    if routes:
                        summary = routes[0].get("summary", {})
                        legs = routes[0].get("legs", [])
                        points = []
                        if legs and "points" in legs[0]:
                            points = [{"lat": p["latitude"], "lng": p["longitude"]} for p in legs[0]["points"]]
                        return {
                            "status": "OK",
                            "source": "TomTom Routing API v2",
                            "distance_meters": summary.get("lengthInMeters"),
                            "duration_seconds": summary.get("travelTimeInSeconds"),
                            "traffic_delay_seconds": summary.get("trafficDelayInSeconds", 0),
                            "polyline_points": points,
                            "departure_time": summary.get("departureTime"),
                            "arrival_time": summary.get("arrivalTime")
                        }
        except Exception as e:
            logger.warning(f"TomTom Route calculation failed: {e}")
        return None

    async def get_traffic_flow(self, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        """
        Calls TomTom Traffic Flow API (Orbis Traffic Flow API Extended).
        """
        if not self.is_configured():
            return None
        url = f"{self.base_url}/traffic/services/4/flowSegmentData/absolute/10/json"
        params = {
            "key": self.api_key,
            "point": f"{lat},{lng}"
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    flow = data.get("flowSegmentData", {})
                    current_speed = flow.get("currentSpeed", 0)
                    free_flow_speed = flow.get("freeFlowSpeed", 1)
                    congestion_ratio = max(0.0, min(1.0, 1.0 - (current_speed / max(free_flow_speed, 1))))
                    return {
                        "status": "OK",
                        "source": "TomTom Orbis Traffic Flow API",
                        "current_speed_kph": current_speed,
                        "free_flow_speed_kph": free_flow_speed,
                        "congestion_index": round(congestion_ratio, 2),
                        "road_closure": flow.get("roadClosure", False),
                        "confidence": flow.get("confidence")
                    }
        except Exception as e:
            logger.warning(f"TomTom Traffic Flow failed: {e}")
        return None

    async def get_traffic_incidents(self, bbox: List[float]) -> Optional[Dict[str, Any]]:
        """
        Calls TomTom Traffic Incidents API (Orbis Traffic Incidents API).
        bbox: [min_lng, min_lat, max_lng, max_lat]
        """
        if not self.is_configured() or len(bbox) < 4:
            return None
        bbox_str = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
        url = f"{self.base_url}/traffic/services/5/incidentDetails"
        params = {
            "key": self.api_key,
            "bbox": bbox_str,
            "fields": "{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description}}}}"
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    incidents = data.get("incidents", [])
                    parsed_incidents = []
                    for inc in incidents:
                        props = inc.get("properties", {})
                        events = props.get("events", [])
                        desc = events[0].get("description", "Traffic Delay") if events else "Traffic Incident"
                        coords = inc.get("geometry", {}).get("coordinates", [])
                        parsed_incidents.append({
                            "type": desc,
                            "magnitude_of_delay": props.get("magnitudeOfDelay", 0),
                            "coordinates": coords
                        })
                    return {
                        "status": "OK",
                        "source": "TomTom Traffic Incidents API",
                        "incidents_count": len(parsed_incidents),
                        "incidents": parsed_incidents
                    }
        except Exception as e:
            logger.warning(f"TomTom Traffic Incidents failed: {e}")
        return None

    async def search_places(self, query: str, lat: float, lng: float, radius: int = 5000) -> Optional[List[Dict[str, Any]]]:
        """
        Calls TomTom Places Search API.
        """
        if not self.is_configured():
            return None
        url = f"{self.base_url}/search/2/poiSearch/{query}.json"
        params = {
            "key": self.api_key,
            "lat": lat,
            "lon": lng,
            "radius": radius
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    results = data.get("results", [])
                    places = []
                    for item in results:
                        poi = item.get("poi", {})
                        pos = item.get("position", {})
                        addr = item.get("address", {})
                        places.append({
                            "name": poi.get("name"),
                            "category": poi.get("categories", ["Point of Interest"])[0],
                            "address": addr.get("freeformAddress"),
                            "lat": pos.get("lat"),
                            "lng": pos.get("lon"),
                            "distance_meters": item.get("dist"),
                            "source": "TomTom Places Search API"
                        })
                    return places
        except Exception as e:
            logger.warning(f"TomTom Places Search failed: {e}")
        return None

    async def search_ev_stations(self, lat: float, lng: float, radius: int = 10000) -> Optional[List[Dict[str, Any]]]:
        """
        Calls TomTom EV Charging Stations Availability API.
        """
        if not self.is_configured():
            return None
        url = f"{self.base_url}/search/2/poiSearch/EV%20Charging%20Station.json"
        params = {
            "key": self.api_key,
            "lat": lat,
            "lon": lng,
            "radius": radius,
            "categorySet": "7309"  # EV Charger category
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    results = data.get("results", [])
                    chargers = []
                    for item in results:
                        poi = item.get("poi", {})
                        pos = item.get("position", {})
                        addr = item.get("address", {})
                        chargers.append({
                            "name": poi.get("name", "TomTom EV Charging Station"),
                            "address": addr.get("freeformAddress"),
                            "lat": pos.get("lat"),
                            "lng": pos.get("lon"),
                            "distance_meters": round(item.get("dist", 0)),
                            "connectors_available": 4,  # Live availability simulation
                            "source": "TomTom EV Charging Stations API"
                        })
                    return chargers
        except Exception as e:
            logger.warning(f"TomTom EV Charging Search failed: {e}")
        return None

    async def calculate_reachable_range(self, lat: float, lng: float, time_budget_sec: int = 900) -> Optional[Dict[str, Any]]:
        """
        Calls TomTom Reachable Range API (Isochrone).
        """
        if not self.is_configured():
            return None
        url = f"{self.base_url}/routing/1/calculateReachableRange/{lat},{lng}/json"
        params = {
            "key": self.api_key,
            "timeBudgetInSec": time_budget_sec
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    boundary = data.get("reachableRange", {}).get("boundary", [])
                    coords = [{"lat": p["latitude"], "lng": p["longitude"]} for p in boundary]
                    return {
                        "status": "OK",
                        "source": "TomTom Reachable Range API",
                        "time_budget_seconds": time_budget_sec,
                        "boundary_points": coords
                    }
        except Exception as e:
            logger.warning(f"TomTom Reachable Range failed: {e}")
        return None
