import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

class IncidentType(str, enum.Enum):
    ACCIDENT = "accident"
    CLOSURE = "closure"
    HAZARD = "hazard"
    TRAFFIC = "traffic"
    WATERLOGGING = "waterlogging"
    POTHOLE = "pothole"
    STRAY_ANIMAL = "stray_animal"
    POLICE_CHECK = "police_check"
    EVENT = "event"

class IncidentSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class User:
    def __init__(self, id=None, email=None, password_hash=None, display_name=None, phone_number=None, firebase_uid=None, created_at=None, updated_at=None):
        self.id = id or uuid.uuid4()
        self.email = email
        self.password_hash = password_hash
        self.display_name = display_name
        self.phone_number = phone_number
        self.firebase_uid = firebase_uid
        self.created_at = created_at or datetime.now(timezone.utc)
        self.updated_at = updated_at or datetime.now(timezone.utc)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]):
        if not data:
            return None
        return cls(
            id=data.get("_id"),
            email=data.get("email"),
            password_hash=data.get("password_hash"),
            display_name=data.get("display_name"),
            phone_number=data.get("phone_number"),
            firebase_uid=data.get("firebase_uid"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at")
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "email": self.email,
            "password_hash": self.password_hash,
            "display_name": self.display_name,
            "phone_number": self.phone_number,
            "firebase_uid": self.firebase_uid,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }

class Incident:
    def __init__(self, id=None, type=None, severity=IncidentSeverity.MEDIUM, description=None, location=None, reporter_id=None, is_active=True, upvotes=0, created_at=None, expires_at=None):
        self.id = id or uuid.uuid4()
        self.type = type
        self.severity = severity
        self.description = description
        self.location = location  # {"type": "Point", "coordinates": [lng, lat]}
        self.reporter_id = reporter_id
        self.is_active = is_active
        self.upvotes = upvotes
        self.created_at = created_at or datetime.now(timezone.utc)
        self.expires_at = expires_at

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]):
        if not data:
            return None
        return cls(
            id=data.get("_id"),
            type=IncidentType(data.get("type")) if data.get("type") else None,
            severity=IncidentSeverity(data.get("severity")) if data.get("severity") else IncidentSeverity.MEDIUM,
            description=data.get("description"),
            location=data.get("location"),
            reporter_id=data.get("reporter_id"),
            is_active=data.get("is_active", True),
            upvotes=data.get("upvotes", 0),
            created_at=data.get("created_at"),
            expires_at=data.get("expires_at")
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "type": self.type.value if hasattr(self.type, "value") else self.type,
            "severity": self.severity.value if hasattr(self.severity, "value") else self.severity,
            "description": self.description,
            "location": self.location,
            "reporter_id": self.reporter_id,
            "is_active": self.is_active,
            "upvotes": self.upvotes,
            "created_at": self.created_at,
            "expires_at": self.expires_at
        }

class Place:
    def __init__(self, id=None, google_place_id=None, name=None, address=None, location=None, rating=0, user_ratings_total=0, created_at=None):
        self.id = id or uuid.uuid4()
        self.google_place_id = google_place_id
        self.name = name
        self.address = address
        self.location = location  # {"type": "Point", "coordinates": [lng, lat]}
        self.rating = rating
        self.user_ratings_total = user_ratings_total
        self.created_at = created_at or datetime.now(timezone.utc)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]):
        if not data:
            return None
        return cls(
            id=data.get("_id"),
            google_place_id=data.get("google_place_id"),
            name=data.get("name"),
            address=data.get("address"),
            location=data.get("location"),
            rating=data.get("rating", 0),
            user_ratings_total=data.get("user_ratings_total", 0),
            created_at=data.get("created_at")
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "google_place_id": self.google_place_id,
            "name": self.name,
            "address": self.address,
            "location": self.location,
            "rating": self.rating,
            "user_ratings_total": self.user_ratings_total,
            "created_at": self.created_at
        }

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
