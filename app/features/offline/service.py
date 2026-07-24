from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any

class OfflineService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def cache_region_data(
        self, lat_min: float, lng_min: float, lat_max: float, lng_max: float
    ) -> Dict[str, Any]:
        bbox_query = {
            "location": {
                "$geoWithin": {
                    "$box": [
                        [lng_min, lat_min],
                        [lng_max, lat_max]
                    ]
                }
            }
        }
        
        places_cursor = self.db.places.find(bbox_query)
        places_list = []
        async for p in places_cursor:
            places_list.append({
                "id": str(p["_id"]),
                "google_place_id": p["google_place_id"],
                "name": p["name"],
                "address": p.get("address"),
                "lat": p["location"]["coordinates"][1],
                "lng": p["location"]["coordinates"][0],
                "rating": p.get("rating", 0),
                "user_ratings_total": p.get("user_ratings_total", 0),
                "created_at": p["created_at"].isoformat() if p.get("created_at") else None
            })
            
        incidents_cursor = self.db.incidents.find({
            "is_active": True,
            **bbox_query
        })
        incidents_list = []
        async for inc in incidents_cursor:
            incidents_list.append({
                "id": str(inc["_id"]),
                "type": str(inc["type"]),
                "severity": str(inc["severity"]),
                "description": inc.get("description"),
                "lat": inc["location"]["coordinates"][1],
                "lng": inc["location"]["coordinates"][0],
                "upvotes": inc.get("upvotes", 0),
                "created_at": inc["created_at"].isoformat() if inc.get("created_at") else None
            })
            
        return {
            "bbox": {
                "lat_min": lat_min,
                "lng_min": lng_min,
                "lat_max": lat_max,
                "lng_max": lng_max
            },
            "places": places_list,
            "incidents": incidents_list
        }

    async def get_offline_cities(self) -> list:
        return [
            {
                "city_id": "beijing",
                "name": "Beijing",
                "country": "China",
                "package_size_bytes": 1024 * 1024 * 342,
                "last_updated": "2026-06-20T00:00:00Z",
                "bbox": {"lat_min": 39.4, "lng_min": 115.7, "lat_max": 41.1, "lng_max": 117.4}
            },
            {
                "city_id": "shanghai",
                "name": "Shanghai",
                "country": "China",
                "package_size_bytes": 1024 * 1024 * 412,
                "last_updated": "2026-06-18T00:00:00Z",
                "bbox": {"lat_min": 30.6, "lng_min": 120.8, "lat_max": 31.9, "lng_max": 122.2}
            },
            {
                "city_id": "bengaluru",
                "name": "Bengaluru",
                "country": "India",
                "package_size_bytes": 1024 * 1024 * 156,
                "last_updated": "2026-06-25T00:00:00Z",
                "bbox": {"lat_min": 12.8, "lng_min": 77.4, "lat_max": 13.1, "lng_max": 77.8}
            }
        ]

    async def get_offline_package(self, city_id: str) -> dict:
        cities = await self.get_offline_cities()
        city_info = next((c for c in cities if c["city_id"] == city_id.lower()), None)
        if not city_info:
            return {
                "success": False,
                "error": f"City {city_id} is not supported for offline download."
            }

        return {
            "success": True,
            "city_id": city_id,
            "city_name": city_info["name"],
            "download_url": f"https://offline-maps.bmap.app/packages/{city_id}_v202606.zip",
            "package_size_bytes": city_info["package_size_bytes"],
            "md5_checksum": f"mock_checksum_md5_{city_id}"
        }
