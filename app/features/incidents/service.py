from motor.motor_asyncio import AsyncIOMotorDatabase
from app.features.incidents.models import Incident, IncidentType, IncidentSeverity
from app.features.incidents.schemas import IncidentCreate, IncidentResponse, IncidentQuery
from uuid import UUID
from typing import List

class IncidentService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def report_incident(self, reporter_id: UUID, incident_in: IncidentCreate) -> Incident:
        location = {
            "type": "Point",
            "coordinates": [incident_in.lng, incident_in.lat]
        }
        incident = Incident(
            type=incident_in.type,
            severity=incident_in.severity,
            description=incident_in.description,
            location=location,
            reporter_id=reporter_id
        )
        await self.db.incidents.insert_one(incident.to_dict())
        return incident

    async def get_nearby_incidents(self, query: IncidentQuery) -> List[IncidentResponse]:
        radians = query.radius / 6378100.0
        
        cursor = self.db.incidents.find({
            "location": {
                "$geoWithin": {
                    "$centerSphere": [[query.lng, query.lat], radians]
                }
            },
            "is_active": True
        }).sort("created_at", -1)
        
        incidents = []
        async for doc in cursor:
            incidents.append(IncidentResponse(
                id=doc["_id"],
                type=IncidentType(doc["type"]),
                severity=IncidentSeverity(doc["severity"]),
                description=doc.get("description"),
                lat=doc["location"]["coordinates"][1],
                lng=doc["location"]["coordinates"][0],
                reporter_id=doc.get("reporter_id"),
                is_active=doc.get("is_active", True),
                upvotes=doc.get("upvotes", 0),
                created_at=doc["created_at"],
                expires_at=doc.get("expires_at")
            ))
        return incidents
