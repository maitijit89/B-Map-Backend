from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.db.models import Place, Incident
from typing import Dict, Any
from geoalchemy2.functions import ST_X, ST_Y, ST_AsText

class OfflineService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def cache_region_data(
        self, lat_min: float, lng_min: float, lat_max: float, lng_max: float
    ) -> Dict[str, Any]:
        # Spatial bounding box envelope
        envelope = func.ST_MakeEnvelope(lng_min, lat_min, lng_max, lat_max, 4326)
        
        # 1. Fetch places within envelope
        places_stmt = select(
            Place,
            ST_X(ST_AsText(Place.location)).label("lng"),
            ST_Y(ST_AsText(Place.location)).label("lat")
        ).where(
            func.ST_Contains(envelope, Place.location)
        )
        places_res = await self.db.execute(places_stmt)
        
        places_list = []
        for row in places_res:
            p = row[0]
            places_list.append({
                "id": str(p.id),
                "google_place_id": p.google_place_id,
                "name": p.name,
                "address": p.address,
                "lat": row.lat,
                "lng": row.lng,
                "rating": p.rating,
                "user_ratings_total": p.user_ratings_total,
                "created_at": p.created_at.isoformat() if p.created_at else None
            })
            
        # 2. Fetch active incidents within envelope
        incidents_stmt = select(
            Incident,
            ST_X(ST_AsText(Incident.location)).label("lng"),
            ST_Y(ST_AsText(Incident.location)).label("lat")
        ).where(
            Incident.is_active == True,
            func.ST_Contains(envelope, Incident.location)
        )
        incidents_res = await self.db.execute(incidents_stmt)
        
        incidents_list = []
        for row in incidents_res:
            inc = row[0]
            incidents_list.append({
                "id": str(inc.id),
                "type": inc.type.value if hasattr(inc.type, 'value') else str(inc.type),
                "severity": inc.severity.value if hasattr(inc.severity, 'value') else str(inc.severity),
                "description": inc.description,
                "lat": row.lat,
                "lng": row.lng,
                "upvotes": inc.upvotes,
                "created_at": inc.created_at.isoformat() if inc.created_at else None
            })
            
        return {
            "bbox": {
                "lat_min": lat_min,
                "lng_min": lng_min,
                "lat_max": lat_max,
                "lng_max": lng_max
            },
            "places": places_list,
            "incidents": incidents_list
        }
