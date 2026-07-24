import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

class Timeline:
    def __init__(self, id=None, user_id=None, location=None, timestamp=None):
        self.id = id or uuid.uuid4()
        self.user_id = user_id
        self.location = location  # {"type": "Point", "coordinates": [lng, lat]}
        self.timestamp = timestamp or datetime.now(timezone.utc)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]):
        if not data:
            return None
        return cls(
            id=data.get("_id"),
            user_id=data.get("user_id"),
            location=data.get("location"),
            timestamp=data.get("timestamp")
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "user_id": self.user_id,
            "location": self.location,
            "timestamp": self.timestamp
        }
