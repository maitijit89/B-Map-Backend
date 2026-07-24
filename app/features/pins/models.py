import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

class Pin:
    def __init__(self, id=None, user_id=None, name=None, description=None, location=None, created_at=None):
        self.id = id or uuid.uuid4()
        self.user_id = user_id
        self.name = name
        self.description = description
        self.location = location  # {"type": "Point", "coordinates": [lng, lat]}
        self.created_at = created_at or datetime.now(timezone.utc)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]):
        if not data:
            return None
        return cls(
            id=data.get("_id"),
            user_id=data.get("user_id"),
            name=data.get("name"),
            description=data.get("description"),
            location=data.get("location"),
            created_at=data.get("created_at")
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description,
            "location": self.location,
            "created_at": self.created_at
        }
