import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

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

class ParkingSpace:
    def __init__(self, id=None, name=None, location=None, total_spots=100, available_spots=100, price_per_hour=0.0, created_at=None):
        self.id = id or uuid.uuid4()
        self.name = name
        self.location = location
        self.total_spots = total_spots
        self.available_spots = available_spots
        self.price_per_hour = price_per_hour
        self.created_at = created_at or datetime.now(timezone.utc)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]):
        if not data:
            return None
        return cls(
            id=data.get("_id"),
            name=data.get("name"),
            location=data.get("location"),
            total_spots=data.get("total_spots", 100),
            available_spots=data.get("available_spots", 100),
            price_per_hour=data.get("price_per_hour", 0.0),
            created_at=data.get("created_at")
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "name": self.name,
            "location": self.location,
            "total_spots": self.total_spots,
            "available_spots": self.available_spots,
            "price_per_hour": self.price_per_hour,
            "created_at": self.created_at
        }

class StreetPanorama:
    def __init__(self, id=None, location=None, heading=0.0, pitch=0.0, capture_date=None, historical_captures=None):
        self.id = id or uuid.uuid4()
        self.location = location
        self.heading = heading
        self.pitch = pitch
        self.capture_date = capture_date or datetime.now(timezone.utc)
        self.historical_captures = historical_captures or []

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]):
        if not data:
            return None
        return cls(
            id=data.get("_id"),
            location=data.get("location"),
            heading=data.get("heading", 0.0),
            pitch=data.get("pitch", 0.0),
            capture_date=data.get("capture_date"),
            historical_captures=data.get("historical_captures", [])
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "location": self.location,
            "heading": self.heading,
            "pitch": self.pitch,
            "capture_date": self.capture_date,
            "historical_captures": self.historical_captures
        }

class IndoorFloorPlan:
    def __init__(self, id=None, name=None, location=None, floors=None):
        self.id = id or uuid.uuid4()
        self.name = name
        self.location = location
        self.floors = floors or []

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]):
        if not data:
            return None
        return cls(
            id=data.get("_id"),
            name=data.get("name"),
            location=data.get("location"),
            floors=data.get("floors", [])
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": self.id,
            "name": self.name,
            "location": self.location,
            "floors": self.floors
        }
