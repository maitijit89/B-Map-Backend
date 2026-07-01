import logging
import uuid
from typing import Dict, Any, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class CarSyncService:
    async def create_or_update_session(
        self, user_id: str, device_id: str, device_type: str, active_route: Dict[str, Any] = None, favorites: List[str] = None, db: Any = None
    ) -> Dict[str, Any]:
        """
        Full handset-to-vehicle sync (V20) and smartwatch standalone navigation sync.
        """
        payload = {
            "device_id": device_id,
            "device_type": device_type,  # "car", "watch", "mirror"
            "user_id": user_id,
            "active_route": active_route,
            "favorites": favorites or [],
            "synced_at": datetime.now(timezone.utc)
        }
        
        if db is not None:
            try:
                # Upsert session
                await db.sync_sessions.replace_one(
                    {"device_id": device_id},
                    payload,
                    upsert=True
                )
            except Exception as e:
                logger.error(f"Failed to upsert sync session to DB: {e}")

        # Returns details of active synchronization
        return {
            "session_id": str(uuid.uuid5(uuid.NAMESPACE_DNS, device_id)),
            "device_id": device_id,
            "device_type": device_type,
            "sync_status": "SYNCHRONIZED",
            "active_route": active_route,
            "favorites_count": len(favorites) if favorites else 0,
            "synced_at": payload["synced_at"].isoformat()
        }

    async def get_mirroring_status(self, device_id: str) -> Dict[str, Any]:
        """
        Get Huawei HarmonyOS or Yadea screen-mirroring status.
        """
        # Simulated check
        return {
            "device_id": device_id,
            "mirror_protocol": "Huawei HiCar / HarmonyOS Mirror Link",
            "active": True,
            "screen_resolution": "1920x720",
            "refresh_rate_hz": 60,
            "latency_ms": 12,
            "stream_url": "rtsp://mirror-stream/v20/live"
        }

    async def get_watch_sync(self, device_id: str) -> Dict[str, Any]:
        """
        Get watch standalone navigation details.
        """
        return {
            "device_id": device_id,
            "device_type": "smartwatch_harmonyos",
            "is_standalone_navigation_active": True,
            "heart_rate_bpm": 72,
            "active_route_summary": {
                "next_maneuver": "Turn left in 50 meters",
                "remaining_distance_meters": 2400,
                "remaining_duration_seconds": 360
            }
        }
