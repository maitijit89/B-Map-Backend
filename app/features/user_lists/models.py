import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

class UserList:
    def __init__(self, id=None, user_id=None, name=None, is_public=False, created_at=None, place_ids=None):
        self.id = id or uuid.uuid4()
        self.user_id = user_id
        self.name = name
        self.is_public = is_public
        self.created_at = created_at or datetime.now(timezone.utc)
        self.place_ids = place_ids or []

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]):
        if not data:
            return None
        return cls(
            id=data.get("_id"),
            user_id=data.get("user_id"),
            name=data.get("name"),
            is_public=data.get("is_public", False),
            created_at=data.get("created_at"),
            place_ids=data.get("place_ids", [])
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "is_public": self.is_public,
            "created_at": self.created_at,
            "place_ids": self.place_ids
        }
