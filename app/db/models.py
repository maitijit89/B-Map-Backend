import enum
from sqlalchemy import Column, String, DateTime, func, Integer, Boolean, Enum, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography
import uuid
from app.db.session import Base

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

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=True, index=True)
    password_hash = Column(String, nullable=True)
    display_name = Column(String)
    phone_number = Column(String, unique=True, nullable=True, index=True)
    firebase_uid = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(Enum(IncidentType), nullable=False)
    severity = Column(Enum(IncidentSeverity), default=IncidentSeverity.MEDIUM)
    description = Column(String)
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    upvotes = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)

class Place(Base):
    __tablename__ = "places"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_place_id = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String)
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    rating = Column(Integer)
    user_ratings_total = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Review(Base):
    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    place_id = Column(UUID(as_uuid=True), ForeignKey("places.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Pin(Base):
    __tablename__ = "pins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String)
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Timeline(Base):
    __tablename__ = "timeline"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

# Junction table for many-to-many relationship between UserList and Place
user_list_places = Table(
    "user_list_places",
    Base.metadata,
    Column("list_id", UUID(as_uuid=True), ForeignKey("user_lists.id", ondelete="CASCADE"), primary_key=True),
    Column("place_id", UUID(as_uuid=True), ForeignKey("places.id", ondelete="CASCADE"), primary_key=True)
)

class UserList(Base):
    __tablename__ = "user_lists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Many-to-many relationship
    places = relationship("Place", secondary=user_list_places, backref="lists")
