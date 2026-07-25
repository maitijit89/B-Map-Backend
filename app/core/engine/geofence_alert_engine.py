import math
from typing import List, Dict, Any, Tuple

def point_in_polygon(lat: float, lng: float, polygon: List[List[float]]) -> bool:
    """
    Ray-casting algorithm to test whether a (lat, lng) point is inside a polygon boundary.
    polygon: List of [lat, lng] points.
    """
    n = len(polygon)
    inside = False
    p1_lat, p1_lng = polygon[0]

    for i in range(n + 1):
        p2_lat, p2_lng = polygon[i % n]
        if lng > min(p1_lng, p2_lng):
            if lng <= max(p1_lng, p2_lng):
                if lat <= max(p1_lat, p2_lat):
                    if p1_lng != p2_lng:
                        xinters = (lng - p1_lng) * (p2_lat - p1_lat) / (p2_lng - p1_lng) + p1_lat
                    else:
                        xinters = p1_lat
                    if p1_lat == p2_lat or lat <= xinters:
                        inside = not inside
        p1_lat, p1_lng = p2_lat, p2_lng

    return inside

class SpatialGeofenceEngine:
    """
    Spatial Geofencing & Alert Engine.
    Executes high-performance ray-casting point-in-polygon containment checks,
    perimeter distance calculations, and dynamic safety/hazard alert triggers.
    """
    def check_geofences(
        self,
        user_lat: float,
        user_lng: float,
        speed_kph: float = 0.0,
        active_geofences: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Evaluates user position against active spatial geofence boundaries.
        """
        # Default sample geofences if none provided
        geofences = active_geofences or [
            {
                "fence_id": "fence_speed_01",
                "name": "School Zone Speed Enforcement",
                "type": "SPEED_ENFORCEMENT_ZONE",
                "speed_limit_kph": 30.0,
                "severity": "WARNING",
                "polygon": [
                    [28.6000, 77.2000],
                    [28.6050, 77.2000],
                    [28.6050, 77.2050],
                    [28.6000, 77.2050]
                ]
            },
            {
                "fence_id": "fence_monsoon_02",
                "name": "Pragati Maidan Flood Hazard Zone",
                "type": "MONSOON_FLOOD_HAZARD",
                "risk_level": "HIGH",
                "severity": "CRITICAL",
                "polygon": [
                    [28.6100, 77.2200],
                    [28.6200, 77.2200],
                    [28.6200, 77.2300],
                    [28.6100, 77.2300]
                ]
            },
            {
                "fence_id": "fence_eco_03",
                "name": "Low Emission Eco Zone",
                "type": "ECO_RESTRICTION_ZONE",
                "allowed_vehicles": ["EV", "HYBRID", "BS6"],
                "severity": "INFO",
                "polygon": [
                    [22.5500, 88.3500],
                    [22.5800, 88.3500],
                    [22.5800, 88.3800],
                    [22.5500, 88.3800]
                ]
            }
        ]

        triggered_alerts = []
        inside_fences_count = 0

        for gf in geofences:
            polygon = gf.get("polygon", [])
            if polygon and point_in_polygon(user_lat, user_lng, polygon):
                inside_fences_count += 1
                gf_type = gf.get("type", "GENERAL")
                alert_msg = f"Entered {gf.get('name', 'Geofence Zone')}"
                
                # Check speed violation inside speed zone
                is_speed_violation = False
                if gf_type == "SPEED_ENFORCEMENT_ZONE":
                    limit = gf.get("speed_limit_kph", 30.0)
                    if speed_kph > limit:
                        is_speed_violation = True
                        alert_msg = f"SPEED WARNING: Driving {speed_kph} km/h in {limit} km/h {gf.get('name')}!"

                triggered_alerts.append({
                    "fence_id": gf.get("fence_id"),
                    "name": gf.get("name"),
                    "type": gf_type,
                    "severity": "CRITICAL" if is_speed_violation else gf.get("severity", "INFO"),
                    "alert_message": alert_msg,
                    "speed_violation": is_speed_violation
                })

        return {
            "status": "OK",
            "user_location": [user_lat, user_lng],
            "speed_kph": speed_kph,
            "inside_geofences_count": inside_fences_count,
            "has_active_alerts": len(triggered_alerts) > 0,
            "triggered_alerts": triggered_alerts
        }
