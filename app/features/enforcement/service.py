import uuid
import logging
from typing import List
from app.features.enforcement.models import Camera, RouteCheckRequest, EnforcementWarning

logger = logging.getLogger(__name__)

class EnforcementService:
    def __init__(self):
        # Mock database of cameras
        self.mock_cameras = [
            Camera(id="cam_1", lat=28.6139, lng=77.2090, type="SPEED", speed_limit=60),
            Camera(id="cam_2", lat=28.6140, lng=77.2100, type="RED_LIGHT")
        ]

    async def get_nearby_cameras(self, lat: float, lng: float, radius: int = 5000) -> List[Camera]:
        # Mock returning all cameras
        return self.mock_cameras

    async def check_route_for_cameras(self, request: RouteCheckRequest) -> List[EnforcementWarning]:
        warnings = []
        # Mock logic: Assuming the user is near cam_1
        for cam in self.mock_cameras:
            # Fake distance calculation for mock
            distance = 450 # 450 meters away
            
            if distance < 1000:
                is_speeding = False
                if cam.type == "SPEED" and cam.speed_limit:
                    is_speeding = request.current_speed_kph > cam.speed_limit
                    
                warnings.append(EnforcementWarning(
                    camera_id=cam.id,
                    camera_type=cam.type,
                    distance_meters=distance,
                    speed_limit=cam.speed_limit,
                    is_speeding=is_speeding
                ))
        return warnings
