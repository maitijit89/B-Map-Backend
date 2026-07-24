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
    SPEED_CAMERA = "speed_camera"
    CONSTRUCTION = "construction"
    ROAD_DAMAGE = "road_damage"
    FASTAG_CONGESTION = "fastag_congestion"
    UNPAVED_ROAD = "unpaved_road"
    PROTEST_BLOCKADE = "protest_blockade"

class IncidentSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Incident:
    def __init__(self, id=None, type=None, severity=IncidentSeverity.MEDIUM, description=None, location=None, reporter_id=None, is_active=True, upvotes=0, created_at=None, expires_at=None, traffic_linkage_status="pending", government_feed_id=None):
        self.id = id or uuid.uuid4()
        self.type = type
        self.severity = severity
        self.description = description
        self.location = location
        self.reporter_id = reporter_id
        self.is_active = is_active
        self.upvotes = upvotes
        self.created_at = created_at or datetime.now(timezone.utc)
        self.expires_at = expires_at
        self.traffic_linkage_status = traffic_linkage_status
        self.government_feed_id = government_feed_id

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
            expires_at=data.get("expires_at"),
            traffic_linkage_status=data.get("traffic_linkage_status", "pending"),
            government_feed_id=data.get("government_feed_id")
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
            "expires_at": self.expires_at,
            "traffic_linkage_status": self.traffic_linkage_status,
            "government_feed_id": self.government_feed_id
        }
