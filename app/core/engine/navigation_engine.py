import math
from typing import List, Dict, Any, Optional
from app.core.engine.search_engine import haversine_distance

def calculate_bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculates initial bearing (0 to 360 degrees) from point 1 to point 2.
    """
    lat1, lng1 = math.radians(lat1), math.radians(lng1)
    lat2, lng2 = math.radians(lat2), math.radians(lng2)
    delta_lng = lng2 - lng1

    y = math.sin(delta_lng) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lng)
    initial_bearing = math.atan2(y, x)
    initial_bearing = math.degrees(initial_bearing)
    return (initial_bearing + 360.0) % 360.0

def determine_turn_maneuver(prev_bearing: float, current_bearing: float) -> str:
    """
    Determines maneuver type based on relative bearing change.
    """
    diff = (current_bearing - prev_bearing + 360.0) % 360.0
    if diff > 180.0:
        diff -= 360.0

    if -20 <= diff <= 20:
        return "CONTINUE_STRAIGHT"
    elif 20 < diff <= 45:
        return "SLIGHT_RIGHT"
    elif 45 < diff <= 135:
        return "TURN_RIGHT"
    elif 135 < diff <= 180:
        return "MAKE_UTURN"
    elif -45 <= diff < -20:
        return "SLIGHT_LEFT"
    elif -135 <= diff < -45:
        return "TURN_LEFT"
    else:
        return "MAKE_UTURN"

class TurnByTurnNavigationEngine:
    """
    Real-time turn-by-turn guidance engine:
    - Route snapping
    - Off-route detection (triggers RE_ROUTE_REQUIRED if >35 meters)
    - Next maneuver computation and voice instruction synthesis
    """
    def __init__(self, route_points: List[Dict[str, float]]):
        self.route_points = route_points

    def track_position(self, user_lat: float, user_lng: float) -> Dict[str, Any]:
        if not self.route_points or len(self.route_points) < 2:
            return {
                "status": "NO_ROUTE",
                "re_route_required": False
            }

        # Find closest segment on route
        min_dist = float("inf")
        closest_index = 0

        for i, pt in enumerate(self.route_points):
            d = haversine_distance(user_lat, user_lng, pt["lat"], pt["lng"])
            if d < min_dist:
                min_dist = d
                closest_index = i

        # Off-route detection threshold: 35 meters
        is_off_route = min_dist > 35.0

        if is_off_route:
            return {
                "status": "OFF_ROUTE",
                "re_route_required": True,
                "distance_from_route_meters": round(min_dist, 1),
                "voice_prompt": "You are off route. Recalculating directions."
            }

        # Compute next maneuver
        next_maneuver = "ARRIVED"
        distance_to_next_turn = 0.0
        voice_prompt = "You have arrived at your destination."

        if closest_index < len(self.route_points) - 1:
            curr_pt = self.route_points[closest_index]
            next_pt = self.route_points[closest_index + 1]
            distance_to_next_turn = haversine_distance(user_lat, user_lng, next_pt["lat"], next_pt["lng"])

            if closest_index > 0:
                prev_pt = self.route_points[closest_index - 1]
                b1 = calculate_bearing(prev_pt["lat"], prev_pt["lng"], curr_pt["lat"], curr_pt["lng"])
                b2 = calculate_bearing(curr_pt["lat"], curr_pt["lng"], next_pt["lat"], next_pt["lng"])
                next_maneuver = determine_turn_maneuver(b1, b2)
            else:
                next_maneuver = "CONTINUE_STRAIGHT"

            dist_text = f"{int(distance_to_next_turn)} meters" if distance_to_next_turn < 1000 else f"{round(distance_to_next_turn/1000.0, 1)} kilometers"
            voice_prompt = f"In {dist_text}, {next_maneuver.lower().replace('_', ' ')}."

        # Calculate remaining distance & duration
        remaining_dist_m = 0.0
        for j in range(closest_index, len(self.route_points) - 1):
            p1 = self.route_points[j]
            p2 = self.route_points[j + 1]
            remaining_dist_m += haversine_distance(p1["lat"], p1["lng"], p2["lat"], p2["lng"])

        remaining_time_sec = remaining_dist_m / (40.0 * 1000.0 / 3600.0)

        return {
            "status": "ON_ROUTE",
            "re_route_required": False,
            "closest_step_index": closest_index,
            "next_maneuver": next_maneuver,
            "distance_to_next_turn_meters": round(distance_to_next_turn, 1),
            "remaining_distance_meters": round(remaining_dist_m, 1),
            "remaining_time_seconds": int(round(remaining_time_sec)),
            "voice_prompt": voice_prompt
        }
