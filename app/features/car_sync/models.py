import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

class SyncSession:
    def __init__(self, id=None, user_id=None, device_id=None, device_type="car", active_route=None, favorites=None, synced_at=None):
        self.id = id or uuid.uuid4()
        self.user_id = user_id
        self.device_id = device_id
        self.device_type = device_type
        self.active_route = active_route
        self.favorites = favorites or []
        self.synced_at = synced_at or datetime.now(timezone.utc)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]):
        if not data:
            return None
        return cls(
            id=data.get("_id"),
            user_id=data.get("user_id"),
            device_id=data.get("device_id"),
            device_type=data.get("device_type", "car"),
            active_route=data.get("active_route"),
            favorites=data.get("favorites", []),
            synced_at=data.get("synced_at")
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "user_id": self.user_id,
            "device_id": self.device_id,
            "device_type": self.device_type,
            "active_route": self.active_route,
            "favorites": self.favorites,
            "synced_at": self.synced_at
        }
