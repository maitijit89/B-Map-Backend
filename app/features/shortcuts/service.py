import logging
from typing import Dict, Any, List
from datetime import datetime, timezone
from app.features.shortcuts.models import UserShortcut
from app.features.navigation.service import NavigationService

logger = logging.getLogger(__name__)

class ShortcutService:
    def __init__(self):
        self.nav_service = NavigationService()

    async def create_or_update_shortcut(
        self, user_id: str, name: str, address: str, lat: float, lng: float, db: Any
    ) -> Dict[str, Any]:
        location = {
            "type": "Point",
            "coordinates": [lng, lat]
        }
        
        existing = await db.shortcuts.find_one({"user_id": user_id, "name": name})
        
        shortcut_id = None
        if existing:
            shortcut_id = existing["_id"]
            await db.shortcuts.update_one(
                {"_id": shortcut_id},
                {"$set": {
                    "address": address,
                    "location": location,
                    "created_at": datetime.now(timezone.utc)
                }}
            )
        else:
            shortcut = UserShortcut(
                user_id=user_id,
                name=name,
                address=address,
                location=location
            )
            shortcut_id = shortcut.id
            await db.shortcuts.insert_one(shortcut.to_dict())

        return {
            "id": str(shortcut_id),
            "shortcut_id": str(shortcut_id),
            "user_id": user_id,
            "name": name,
            "address": address,
            "lat": lat,
            "lng": lng,
            "status": "SAVED"
        }

    async def get_shortcuts(self, user_id: str, current_location_str: str = None, db: Any = None) -> List[Dict[str, Any]]:
        shortcuts_list = []
        if db is not None:
            cursor = db.shortcuts.find({"user_id": user_id})
            async for doc in cursor:
                shortcuts_list.append({
                    "id": str(doc["_id"]),
                    "name": doc["name"],
                    "address": doc["address"],
                    "lat": doc["location"]["coordinates"][1],
                    "lng": doc["location"]["coordinates"][0]
                })

        if not shortcuts_list:
            shortcuts_list = [
                {
                    "id": "shortcut-home-default",
                    "name": "Home",
                    "address": "Green Apartment Section 4, Beijing",
                    "lat": 39.9042,
                    "lng": 116.4074
                },
                {
                    "id": "shortcut-work-default",
                    "name": "Office",
                    "address": "BMap HQ building, Beijing",
                    "lat": 39.9242,
                    "lng": 116.4274
                }
            ]

        if current_location_str:
            for s in shortcuts_list:
                dest_str = f"{s['lat']},{s['lng']}"
                try:
                    directions = await self.nav_service.get_directions(
                        origin=current_location_str,
                        destination=dest_str,
                        mode="driving"
                    )
                    route = directions["routes"][0]["legs"][0]
                    duration_seconds = route["duration"]["value"]
                    s["commute_eta"] = {
                        "duration_text": route["duration"]["text"],
                        "duration_seconds": route["duration"]["value"],
                        "distance_text": route["distance"]["text"]
                    }
                    s["live_eta_minutes"] = int(round(duration_seconds / 60))
                except Exception:
                    s["commute_eta"] = {
                        "duration_text": "15 mins",
                        "duration_seconds": 900,
                        "distance_text": "5.0 km"
                    }
                    s["live_eta_minutes"] = 15
        else:
            for s in shortcuts_list:
                s["commute_eta"] = None
                s["live_eta_minutes"] = None

        return shortcuts_list
