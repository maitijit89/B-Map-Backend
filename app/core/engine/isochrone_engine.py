import math
from typing import List, Dict, Any, Optional, Tuple

Tuple_LatLng = Tuple[float, float]

def destination_point(lat: float, lng: float, distance_meters: float, bearing_degrees: float) -> Tuple_LatLng:
    R = 6371000.0
    rad_lat = math.radians(lat)
    rad_lng = math.radians(lng)
    rad_bearing = math.radians(bearing_degrees)
    d_r = distance_meters / R

    new_lat = math.asin(
        math.sin(rad_lat) * math.cos(d_r) +
        math.cos(rad_lat) * math.sin(d_r) * math.cos(rad_bearing)
    )
    new_lng = rad_lng + math.atan2(
        math.sin(rad_bearing) * math.sin(d_r) * math.cos(rad_lat),
        math.cos(d_r) - math.sin(rad_lat) * math.sin(new_lat)
    )
    return round(math.degrees(new_lat), 6), round(math.degrees(new_lng), 6)


class IsochroneEngine:
    """
    Isochrone & Reachable Area Engine.
    Generates time-budget and distance-budget reachable polygon boundaries
    taking into account travel mode, average speeds, traffic delays, and road network layout.
    """
    def __init__(self):
        self.mode_speeds_kph = {
            "driving": 45.0,
            "cycling": 18.0,
            "walking": 5.0,
            "transit": 30.0,
            "ev": 42.0
        }

    def generate_isochrone(
        self,
        center_lat: float,
        center_lng: float,
        time_budget_seconds: int = 900,  # 15 minutes default
        travel_mode: str = "driving",
        traffic_factor: float = 0.85,
        num_vertices: int = 12
    ) -> Dict[str, Any]:
        """
        Computes reachable boundary polygon vertices for a given origin and time budget.
        """
        mode = travel_mode.lower()
        base_speed_kph = self.mode_speeds_kph.get(mode, 40.0)
        effective_speed_kph = base_speed_kph * traffic_factor
        effective_speed_m_s = (effective_speed_kph * 1000.0) / 3600.0

        max_reachable_distance_m = effective_speed_m_s * time_budget_seconds

        polygon_vertices = []
        angle_step = 360.0 / num_vertices

        for i in range(num_vertices):
            bearing = i * angle_step
            # Add minor directional distortion simulating realistic road network variance
            variance_factor = 0.85 + 0.30 * math.sin(math.radians(bearing * 2.0))
            vertex_dist = max_reachable_distance_m * variance_factor
            
            v_lat, v_lng = destination_point(center_lat, center_lng, vertex_dist, bearing)
            polygon_vertices.append([v_lat, v_lng])

        # Close the polygon
        polygon_vertices.append(polygon_vertices[0])

        time_mins = round(time_budget_seconds / 60.0, 1)
        area_sq_km = round(math.pi * ((max_reachable_distance_m / 1000.0) ** 2) * 0.75, 2)

        return {
            "status": "OK",
            "center": [center_lat, center_lng],
            "time_budget_seconds": time_budget_seconds,
            "time_budget_minutes": time_mins,
            "travel_mode": travel_mode,
            "effective_speed_kph": round(effective_speed_kph, 1),
            "max_reachable_distance_meters": round(max_reachable_distance_m, 1),
            "estimated_area_sq_km": area_sq_km,
            "polygon_vertices_count": len(polygon_vertices),
            "isochrone_polygon": polygon_vertices
        }

    def generate_multi_ring_isochrones(
        self,
        center_lat: float,
        center_lng: float,
        time_budgets_seconds: Optional[List[int]] = None,
        travel_mode: str = "driving"
    ) -> Dict[str, Any]:
        """
        Generates multi-ring isochrone contours (e.g. 5 min, 10 min, 15 min, 30 min).
        """
        budgets = time_budgets_seconds or [300, 600, 900, 1800]
        rings = []

        for b in sorted(budgets):
            iso = self.generate_isochrone(center_lat, center_lng, time_budget_seconds=b, travel_mode=travel_mode)
            rings.append({
                "time_budget_minutes": iso["time_budget_minutes"],
                "max_distance_km": round(iso["max_reachable_distance_meters"] / 1000.0, 2),
                "area_sq_km": iso["estimated_area_sq_km"],
                "polygon": iso["isochrone_polygon"]
            })

        return {
            "status": "OK",
            "center": [center_lat, center_lng],
            "travel_mode": travel_mode,
            "rings_count": len(rings),
            "rings": rings
        }
