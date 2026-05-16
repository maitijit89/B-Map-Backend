from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from geoalchemy2.functions import ST_GeomFromText, ST_DWithin, ST_AsText, ST_X, ST_Y
from app.db.models import Incident
from app.schemas.incident import IncidentCreate, IncidentResponse, IncidentQuery
from uuid import UUID
from typing import List

class IncidentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def report_incident(self, reporter_id: UUID, incident_in: IncidentCreate) -> Incident:
        point = f"POINT({incident_in.lng} {incident_in.lat})"
        incident = Incident(
            type=incident_in.type,
            severity=incident_in.severity,
            description=incident_in.description,
            location=point,
            reporter_id=reporter_id
        )
        self.db.add(incident)
        await self.db.commit()
        await self.db.refresh(incident)
        return incident

    async def get_nearby_incidents(self, query: IncidentQuery) -> List[IncidentResponse]:
        center = f"POINT({query.lng} {query.lat})"
        
        # Optimized query selecting specific fields including lat/lng extraction
        stmt = select(
            Incident.id,
            Incident.type,
            Incident.severity,
            Incident.description,
            Incident.reporter_id,
            Incident.is_active,
            Incident.upvotes,
            Incident.created_at,
            Incident.expires_at,
            ST_X(ST_AsText(Incident.location)).label("lng"),
            ST_Y(ST_AsText(Incident.location)).label("lat")
        ).where(
            ST_DWithin(Incident.location, ST_GeomFromText(center, 4326), query.radius),
            Incident.is_active == True
        ).order_by(Incident.created_at.desc())
        
        result = await self.db.execute(stmt)
        return [IncidentResponse.model_validate(dict(row._mapping)) for row in result]
