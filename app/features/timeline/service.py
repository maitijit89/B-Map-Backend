from motor.motor_asyncio import AsyncIOMotorDatabase
from app.features.timeline.models import Timeline
from app.features.timeline.schemas import LocationLog, TimelineResponse, TimelineStatsResponse
from uuid import UUID
from datetime import datetime
from typing import List, Optional, Dict, Any
from math import radians, cos, sin, asin, sqrt

def haversine(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371.0
    return c * r

class TimelineService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def log_location(self, user_id: UUID, location_in: LocationLog) -> TimelineResponse:
        location = {
            "type": "Point",
            "coordinates": [location_in.lng, location_in.lat]
        }
        timeline_entry = Timeline(
            user_id=user_id,
            location=location
        )
        await self.db.timeline.insert_one(timeline_entry.to_dict())
        
        return TimelineResponse(
            id=timeline_entry.id,
            lat=location_in.lat,
            lng=location_in.lng,
            timestamp=timeline_entry.timestamp
        )

    async def get_timeline(
        self, user_id: UUID, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None
    ) -> List[TimelineResponse]:
        query = {"user_id": user_id}
        if start_date or end_date:
            query["timestamp"] = {}
            if start_date:
                query["timestamp"]["$gte"] = start_date
            if end_date:
                query["timestamp"]["$lte"] = end_date
                
        cursor = self.db.timeline.find(query).sort("timestamp", -1)
        timeline = []
        async for doc in cursor:
            timeline.append(TimelineResponse(
                id=doc["_id"],
                lat=doc["location"]["coordinates"][1],
                lng=doc["location"]["coordinates"][0],
                timestamp=doc["timestamp"]
            ))
        return timeline

    async def get_timeline_stats(self, user_id: UUID) -> TimelineStatsResponse:
        cursor = self.db.timeline.find({"user_id": user_id}).sort("timestamp", 1)
        
        class Row:
            def __init__(self, doc):
                self.lng = doc["location"]["coordinates"][0]
                self.lat = doc["location"]["coordinates"][1]
                self.timestamp = doc["timestamp"]
                
        rows = []
        async for doc in cursor:
            rows.append(Row(doc))
        
        if not rows:
            return TimelineStatsResponse(
                total_distance_km=0.0,
                distinct_locations_count=0,
                active_days_count=0,
                most_visited_cluster=[]
            )
            
        total_dist = 0.0
        for i in range(len(rows) - 1):
            total_dist += haversine(
                rows[i].lng, rows[i].lat,
                rows[i+1].lng, rows[i+1].lat
            )
            
        clusters: Dict[tuple, int] = {}
        active_days = set()
        
        for row in rows:
            rounded_coord = (round(row.lat, 3), round(row.lng, 3))
            clusters[rounded_coord] = clusters.get(rounded_coord, 0) + 1
            
            if row.timestamp:
                active_days.add(row.timestamp.date())
                
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
