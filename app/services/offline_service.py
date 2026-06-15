from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any

class OfflineService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def cache_region_data(
        self, lat_min: float, lng_min: float, lat_max: float, lng_max: float
    ) -> Dict[str, Any]:
        # Spatial bounding box query using MongoDB $geoWithin and $box
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
        
        # 1. Fetch places within bounding box
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
            
        # 2. Fetch active incidents within bounding box
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
