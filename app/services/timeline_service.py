from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.db.models import Timeline
from app.schemas.timeline import LocationLog, TimelineResponse, TimelineStatsResponse
from uuid import UUID
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from geoalchemy2.functions import ST_X, ST_Y, ST_AsText
from math import radians, cos, sin, asin, sqrt

def haversine(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    # Convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371.0 # Radius of earth in kilometers
    return c * r

class TimelineService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_location(self, user_id: UUID, location_in: LocationLog) -> TimelineResponse:
        location = f"POINT({location_in.lng} {location_in.lat})"
        timeline_entry = Timeline(
            user_id=user_id,
            location=location
        )
        self.db.add(timeline_entry)
        await self.db.commit()
        await self.db.refresh(timeline_entry)
        
        return TimelineResponse(
            id=timeline_entry.id,
            lat=location_in.lat,
            lng=location_in.lng,
            timestamp=timeline_entry.timestamp
        )

    async def get_timeline(
        self, user_id: UUID, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None
    ) -> List[TimelineResponse]:
        stmt = select(
            Timeline,
            ST_X(ST_AsText(Timeline.location)).label("lng"),
            ST_Y(ST_AsText(Timeline.location)).label("lat")
        ).where(Timeline.user_id == user_id)
        
        if start_date:
            stmt = stmt.where(Timeline.timestamp >= start_date)
        if end_date:
            stmt = stmt.where(Timeline.timestamp <= end_date)
            
        stmt = stmt.order_by(Timeline.timestamp.desc())
        
        result = await self.db.execute(stmt)
        timeline = []
        for row in result:
            t = row[0]
            timeline.append(TimelineResponse(
                id=t.id,
                lat=row.lat,
                lng=row.lng,
                timestamp=t.timestamp
            ))
        return timeline

    async def get_timeline_stats(self, user_id: UUID) -> TimelineStatsResponse:
        # Fetch all points chronologically
        stmt = select(
            ST_X(ST_AsText(Timeline.location)).label("lng"),
            ST_Y(ST_AsText(Timeline.location)).label("lat"),
            Timeline.timestamp
        ).where(Timeline.user_id == user_id).order_by(Timeline.timestamp.asc())
        
        result = await self.db.execute(stmt)
        rows = result.all()
        
        if not rows:
            return TimelineStatsResponse(
                total_distance_km=0.0,
                distinct_locations_count=0,
                active_days_count=0,
                most_visited_cluster=[]
            )
            
        # 1. Total Distance via consecutive Haversine
        total_dist = 0.0
        for i in range(len(rows) - 1):
            total_dist += haversine(
                rows[i].lng, rows[i].lat,
                rows[i+1].lng, rows[i+1].lat
            )
            
        # 2. Grid Clustering & Active Days
        clusters: Dict[tuple, int] = {}
        active_days = set()
        
        for row in rows:
            # Round coordinates to 3 decimal places (~110 meters grid)
            rounded_coord = (round(row.lat, 3), round(row.lng, 3))
            clusters[rounded_coord] = clusters.get(rounded_coord, 0) + 1
            
            # Save active day
            if row.timestamp:
                active_days.add(row.timestamp.date())
                
        # Format top 3 clusters
        sorted_clusters = sorted(clusters.items(), key=lambda x: x[1], reverse=True)
        top_clusters = []
        for coord, count in sorted_clusters[:3]:
            top_clusters.append({
                "lat": coord[0],
                "lng": coord[1],
                "visits": count
            })
            
        return TimelineStatsResponse(
            total_distance_km=round(total_dist, 2),
            distinct_locations_count=len(clusters),
            active_days_count=len(active_days),
            most_visited_cluster=top_clusters
        )
