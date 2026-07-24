import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

class Review:
    def __init__(self, id=None, user_id=None, place_id=None, rating=None, comment=None, created_at=None):
        self.id = id or uuid.uuid4()
        self.user_id = user_id
        self.place_id = place_id
        self.rating = rating
        self.comment = comment
        self.created_at = created_at or datetime.now(timezone.utc)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]):
        if not data:
            return None
        return cls(
            id=data.get("_id"),
            user_id=data.get("user_id"),
            place_id=data.get("place_id"),
            rating=data.get("rating"),
            comment=data.get("comment"),
            created_at=data.get("created_at")
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "user_id": self.user_id,
            "place_id": self.place_id,
            "rating": self.rating,
            "comment": self.comment,
            "created_at": self.created_at
        }
