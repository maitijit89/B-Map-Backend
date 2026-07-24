import httpx
from app.core.config import settings
from app.shared.integrations.tomtom_service import TomTomService
from typing import Dict, Any

class MapsService:
    def __init__(self):
        self.api_key = settings.GOOGLE_PLACES_API_KEY
        self.project_id = "b-map"
        self.tomtom_service = TomTomService()

    def _is_api_key_valid(self) -> bool:
        if not self.api_key:
            return False
        val = self.api_key.lower()
        return not (val.startswith("your_") or "mock" in val or val == "")

    async def create_tile_session(self, map_type: str = "roadmap"):
        if not self._is_api_key_valid():
            return {
                "session": "mock_tile_session_token_123456789",
                "expiry": "86400s",
                "tileWidth": 256,
                "tileHeight": 256,
                "imageFormat": "PNG"
            }

        url = f"https://tile.googleapis.com/v1/createSession?key={self.api_key}"
        body = {
            "mapType": map_type,
            "language": "en-US",
            "region": "US"
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=body)
                return response.json()
        except Exception as e:
            return {"error": str(e)}

    async def get_elevation(self, locations: str):
        if not self._is_api_key_valid():
            results = []
            for loc in locations.split("|"):
                parts = loc.split(",")
                lat = float(parts[0]) if len(parts) > 0 else 37.42
                lng = float(parts[1]) if len(parts) > 1 else -122.08
                results.append({
                    "elevation": 10.5 + (lat - 37.0) * 100,
                    "location": {"lat": lat, "lng": lng},
                    "resolution": 9.5
                })
            return {"results": results, "status": "OK"}

        url = "https://maps.googleapis.com/maps/api/elevation/json"
        params = {
            "locations": locations,
            "key": self.api_key
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                return response.json()
        except Exception:
            return {"results": [], "status": "REQUEST_DENIED"}

    async def get_aerial_view(self, address: str):
        if not self._is_api_key_valid():
            return {
                "state": "COMPLETED",
                "video": {
                    "urls": {
                        "mp4": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                    }
                },
                "address": address
            }

        url = f"https://aerialview.googleapis.com/v1/videos:lookupVideo?key={self.api_key}&address={address}"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                return response.json()
        except Exception as e:
            return {"error": str(e)}

    def get_static_map_url(self, center: str, zoom: int = 14, size: str = "600x400") -> Dict[str, str]:
        key = self.api_key if self._is_api_key_valid() else "mock_key"
        url = f"https://maps.googleapis.com/maps/api/staticmap?center={center}&zoom={zoom}&size={size}&key={key}"
        return {"url": url, "is_mock": not self._is_api_key_valid()}

    def get_street_view_url(self, location: str, size: str = "600x400") -> Dict[str, str]:
        key = self.api_key if self._is_api_key_valid() else "mock_key"
        url = f"https://maps.googleapis.com/maps/api/streetview?location={location}&size={size}&key={key}"
        return {"url": url, "is_mock": not self._is_api_key_valid()}

    async def list_datasets(self):
        if not self._is_api_key_valid():
            return {
                "datasets": [
                    {
                        "name": f"projects/{self.project_id}/datasets/mock-dataset-1",
                        "displayName": "Mock Environmental Data",
                        "status": {"state": "STATE_ACTIVE"}
                    }
                ]
            }

        url = f"https://mapsplatformdatasets.googleapis.com/v1/projects/{self.project_id}/datasets?key={self.api_key}"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                return response.json()
        except Exception as e:
            return {"error": str(e)}

    async def create_dataset(self, display_name: str):
        if not self._is_api_key_valid():
            return {
                "name": f"projects/{self.project_id}/datasets/mock-dataset-new",
                "displayName": display_name,
                "status": {"state": "STATE_IMPORTING"}
            }

        url = f"https://mapsplatformdatasets.googleapis.com/v1/projects/{self.project_id}/datasets?key={self.api_key}"
        body = {"displayName": display_name}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=body)
                return response.json()
        except Exception as e:
            return {"error": str(e)}

    async def delete_dataset(self, dataset_id: str):
        if not self._is_api_key_valid():
            return {"status": "SUCCESS", "message": f"Dataset {dataset_id} deleted."}

        url = f"https://mapsplatformdatasets.googleapis.com/v1/projects/{self.project_id}/datasets/{dataset_id}?key={self.api_key}"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(url)
                return response.json()
        except Exception as e:
            return {"error": str(e)}

    async def convert_coordinates(self, lat: float, lng: float, from_sys: str = "WGS84", to_sys: str = "BD09") -> dict:
        import math
        X_PI = math.pi * 3000.0 / 180.0

        def gcj02_to_bd09(gcj_lng: float, gcj_lat: float) -> tuple:
            z = math.sqrt(gcj_lng * gcj_lng + gcj_lat * gcj_lat) + 0.00002 * math.sin(gcj_lat * X_PI)
            theta = math.atan2(gcj_lat, gcj_lng) + 0.000003 * math.cos(gcj_lng * X_PI)
            bd_lng = z * math.cos(theta) + 0.0065
            bd_lat = z * math.sin(theta) + 0.006
            return bd_lng, bd_lat

        def bd09_to_gcj02(bd_lng: float, bd_lat: float) -> tuple:
            x = bd_lng - 0.0065
            y = bd_lat - 0.006
            z = math.sqrt(x * x + y * y) - 0.00002 * math.sin(y * X_PI)
            theta = math.atan2(y, x) - 0.000003 * math.cos(x * X_PI)
            gcj_lng = z * math.cos(theta)
            gcj_lat = z * math.sin(theta)
            return gcj_lng, gcj_lat

        def wgs84_to_gcj02(lng: float, lat: float) -> tuple:
            if not (72.004 <= lng <= 137.8347 and 0.8293 <= lat <= 55.8271):
                return lng, lat
            dlat = transform_lat(lng - 105.0, lat - 35.0)
            dlng = transform_lng(lng - 105.0, lat - 35.0)
            radlat = lat / 180.0 * math.pi
            magic = math.sin(radlat)
            magic = 1 - 0.00669342162296594323 * magic * magic
            sqrtmagic = math.sqrt(magic)
            dlat = (dlat * 180.0) / ((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtmagic) * math.pi)
            dlng = (dlng * 180.0) / (6378245.0 / sqrtmagic * math.cos(radlat) * math.pi)
            return lng + dlng, lat + dlat

        def transform_lat(x: float, y: float) -> float:
            ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
            ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
            ret += (20.0 * math.sin(y * math.pi) + 40.0 * math.sin(y / 3.0 * math.pi)) * 2.0 / 3.0
            ret += (160.0 * math.sin(y / 12.0 * math.pi) + 320 * math.sin(y * math.pi / 30.0)) * 2.0 / 3.0
            return ret

        def transform_lng(x: float, y: float) -> float:
            ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
            ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
            ret += (20.0 * math.sin(x * math.pi) + 40.0 * math.sin(x / 3.0 * math.pi)) * 2.0 / 3.0
            ret += (150.0 * math.sin(x / 12.0 * math.pi) + 300.0 * math.sin(x / 30.0 * math.pi)) * 2.0 / 3.0
            return ret

        f = from_sys.upper()
        t = to_sys.upper()

        current_lng, current_lat = lng, lat
        if f == "WGS84" and t == "GCJ02":
            current_lng, current_lat = wgs84_to_gcj02(lng, lat)
        elif f == "WGS84" and t == "BD09":
            gcj_lng, gcj_lat = wgs84_to_gcj02(lng, lat)
            current_lng, current_lat = gcj02_to_bd09(gcj_lng, gcj_lat)
        elif f == "GCJ02" and t == "BD09":
            current_lng, current_lat = gcj02_to_bd09(lng, lat)
        elif f == "BD09" and t == "GCJ02":
            current_lng, current_lat = bd09_to_gcj02(lng, lat)
        elif f == "BD09" and t == "WGS84":
            gcj_lng, gcj_lat = bd09_to_gcj02(lng, lat)
            current_lng, current_lat = gcj_lng, gcj_lat

        return {
            "from_system": from_sys,
            "to_system": to_sys,
            "original_lat": lat,
            "original_lng": lng,
            "converted_lat": current_lat,
            "converted_lng": current_lng
        }

    async def get_3d_metadata(self, city: str) -> dict:
        supported_cities = ["beijing", "shanghai", "guangzhou", "shenzhen"]
        is_supported = city.lower() in supported_cities
        return {
            "city": city,
            "is_3d_view_supported": is_supported,
            "lod_levels": ["LOD1", "LOD2", "LOD3"] if is_supported else [],
            "mesh_render_engine": "B-Map 3D WebGL Engine",
            "available_polygons_count": 125000 if is_supported else 0,
            "textures_resolution": "4K" if is_supported else None
        }

    async def get_indoor_map(self, location_name: str, db: Any = None) -> dict:
        if db is not None:
            try:
                doc = await db.indoor_floor_plans.find_one({"name": {"$regex": location_name, "$options": "i"}})
                if doc:
                    return {
                        "id": str(doc["_id"]),
                        "name": doc["name"],
                        "floors": doc.get("floors", [])
                    }
            except Exception:
                pass

        return {
            "name": location_name,
            "supported": True,
            "floors": [
                {
                    "level": -1,
                    "name": "B1 - Subway Transfer & Food Court",
                    "shops": [
                        {"name": "Subway Line Entry A", "type": "transit"},
                        {"name": "Local Noodle Shop", "type": "restaurant"},
                        {"name": "BMap Smart ATM", "type": "atm"}
                    ]
                },
                {
                    "level": 1,
                    "name": "F1 - Main Atrium & Fashion",
                    "shops": [
                        {"name": "Apple Store", "type": "shopping"},
                        {"name": "Information Desk", "type": "service"}
                    ]
                }
            ]
        }

    async def get_streetview_panoramas(self, lat: float, lng: float, db: Any = None) -> dict:
        if db is not None:
            try:
                doc = await db.panoramas.find_one({
                    "location": {
                        "$near": {
                            "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                            "$maxDistance": 500
                        }
                    }
                })
                if doc:
                    return {
                        "id": str(doc["_id"]),
                        "heading": doc.get("heading", 0.0),
                        "pitch": doc.get("pitch", 0.0),
                        "capture_date": doc["capture_date"].isoformat(),
                        "historical_captures": doc.get("historical_captures", []),
                        "fleet_metadata": {
                            "vehicle_type": "BMap Panorama Fleet Vehicle",
                            "camera_system": "BMap Multi-Lens 360 Camera v4",
                            "positioning": ["GPS", "Galileo", "High-Precision Inertial Sensors"]
                        }
                    }
            except Exception:
                pass

        return {
            "id": "pano_mock_123456789",
            "heading": 120.5,
            "pitch": 5.0,
            "capture_date": "2026-05-15T10:30:00Z",
            "historical_captures": [
                {"id": "pano_mock_2024", "year": 2024, "capture_date": "2024-06-12"},
                {"id": "pano_mock_2020", "year": 2020, "capture_date": "2020-09-08"},
                {"id": "pano_mock_2016", "year": 2016, "capture_date": "2016-04-20"},
                {"id": "pano_mock_2013", "year": 2013, "capture_date": "2013-11-03"}
            ],
            "fleet_metadata": {
                "vehicle_type": "Baidu-operated Fleet Vehicle",
                "camera_system": "Multi-lens panorama camera rig",
                "sensors": ["Dual-frequency GPS", "Inertial navigation system (IMU)", "Wheel encoders"]
            }
        }

    async def get_realtime_traffic(self, lat: float, lng: float, radius: float = 5000, db: Any = None) -> dict:
        import datetime

        # Check TomTom Live Traffic Flow API
        if self.tomtom_service.is_configured():
            tomtom_flow = await self.tomtom_service.get_traffic_flow(lat, lng)
            if tomtom_flow:
                c_speed = tomtom_flow.get("current_speed_kph", 50)
                f_speed = tomtom_flow.get("free_flow_speed_kph", 60)
                c_index = tomtom_flow.get("congestion_index", 0.15)
                c_level = "low" if c_index < 0.3 else ("medium" if c_index < 0.6 else "heavy")
                return {
                    "lat": lat,
                    "lng": lng,
                    "radius_meters": radius,
                    "congestion_level": c_level,
                    "congestion_index": c_index,
                    "average_speed_kph": c_speed,
                    "speed_limit_kph": f_speed,
                    "estimated_delay_minutes": round(c_index * 15.0, 1),
                    "source": "TomTom Orbis Traffic Flow API",
                    "road_closure": tomtom_flow.get("road_closure", False),
                    "timestamp": datetime.datetime.now(datetime.UTC).isoformat().replace("+00:00", "Z")
                }
        
        congestion_index = 0.15
        nearby_incidents = []
        
        if db is not None:
            try:
                radians = radius / 6378100.0
                cursor = db.incidents.find({
                    "location": {
                        "$geoWithin": {
                            "$centerSphere": [[lng, lat], radians]
                        }
                    },
                    "is_active": True
                })
                
                async for doc in cursor:
                    severity_weight = 0.1
                    severity = doc.get("severity", "medium").lower()
                    if severity == "high":
                        severity_weight = 0.3
                    elif severity in ["critical", "severe"]:
                        severity_weight = 0.5
                    
                    incident_type = doc.get("type", "traffic").lower()
                    if incident_type in ["accident", "closure", "traffic", "waterlogging", "hazard"]:
                        congestion_index += severity_weight
                    
                    nearby_incidents.append({
                        "id": str(doc["_id"]),
                        "type": doc["type"],
                        "severity": doc["severity"],
                        "description": doc.get("description", ""),
                        "lat": doc["location"]["coordinates"][1],
                        "lng": doc["location"]["coordinates"][0]
                    })
            except Exception as e:
                pass
                
        if congestion_index > 1.0:
            congestion_index = 1.0
            
        if congestion_index < 0.3:
            congestion_level = "low"
        elif congestion_index < 0.6:
            congestion_level = "medium"
        else:
            congestion_level = "heavy"
            
        base_speed = 60.0
        current_speed = max(10.0, base_speed * (1.0 - congestion_index * 0.75))
        delay = congestion_index * 20.0
        
        return {
            "lat": lat,
            "lng": lng,
            "radius_meters": radius,
            "congestion_level": congestion_level,
            "congestion_index": round(congestion_index, 2),
            "average_speed_kph": round(current_speed, 1),
            "speed_limit_kph": base_speed,
            "estimated_delay_minutes": round(delay, 1),
            "nearby_incidents_count": len(nearby_incidents),
            "incidents": nearby_incidents,
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat().replace("+00:00", "Z")
        }
