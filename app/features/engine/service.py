from typing import List, Dict, Any, Optional
from app.core.engine.search_engine import SpatialSearchEngine
from app.core.engine.routing_engine import AStarRoutingEngine
from app.core.engine.navigation_engine import TurnByTurnNavigationEngine
from app.core.engine.map_matching_engine import HiddenMarkovMapMatcher
from app.core.engine.map_engine import MapTileEngine
from app.core.engine.lane_guidance_engine import LaneGuidanceEngine
from app.core.engine.geofence_alert_engine import SpatialGeofenceEngine
from app.core.engine.isochrone_engine import IsochroneEngine
from app.core.engine.ev_energy_routing_engine import EVEnergyRoutingEngine
from app.core.engine.dead_reckoning_engine import DeadReckoningEngine
from app.core.engine.safety_monsoon_engine import MonsoonSafetyEngine
from app.core.engine.ai_traffic_prediction_engine import PredictiveTrafficEngine

class EngineService:
    def __init__(self):
        self.search_engine = SpatialSearchEngine()
        self.map_tile_engine = MapTileEngine()
        self.lane_guidance_engine = LaneGuidanceEngine()
        self.geofence_engine = SpatialGeofenceEngine()
        self.isochrone_engine = IsochroneEngine()
        self.ev_engine = EVEnergyRoutingEngine()
        self.dead_reckoning_engine = DeadReckoningEngine()
        self.monsoon_engine = MonsoonSafetyEngine()
        self.traffic_engine = PredictiveTrafficEngine()

    def rank_places(
        self,
        query: str,
        places: List[Dict[str, Any]],
        user_lat: Optional[float] = None,
        user_lng: Optional[float] = None,
        max_results: int = 10
    ) -> List[Dict[str, Any]]:
        return self.search_engine.rank_places(
            query=query,
            places=places,
            user_lat=user_lat,
            user_lng=user_lng,
            max_results=max_results
        )

    def compute_graph_route(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        start_id: str,
        goal_id: str,
        criteria: str = "fastest"
    ) -> Dict[str, Any]:
        router = AStarRoutingEngine()
        for node in nodes:
            router.add_node(node["id"], float(node["lat"]), float(node["lng"]))
        for edge in edges:
            router.add_edge(
                u_id=edge["u"],
                v_id=edge["v"],
                speed_limit_kph=float(edge.get("speed_kph", 50.0)),
                toll=bool(edge.get("toll", False)),
                surface=str(edge.get("surface", "paved")),
                is_one_way=bool(edge.get("is_one_way", False))
            )
        res = router.find_shortest_path(start_id, goal_id, criteria=criteria)
        if not res:
            return {"status": "NO_PATH_FOUND", "message": f"No valid route from {start_id} to {goal_id}"}
        return res

    def track_navigation_position(
        self,
        route_points: List[Dict[str, float]],
        user_lat: float,
        user_lng: float
    ) -> Dict[str, Any]:
        nav_engine = TurnByTurnNavigationEngine(route_points)
        return nav_engine.track_position(user_lat, user_lng)

    def match_map_trajectory(
        self,
        gps_trace: List[List[float]],
        road_segments: Optional[List[Dict[str, Any]]] = None,
        sigma_z: float = 10.0,
        beta: float = 5.0
    ) -> Dict[str, Any]:
        matcher = HiddenMarkovMapMatcher(sigma_z=sigma_z, beta=beta)
        trace_tuples = [(pt[0], pt[1]) for pt in gps_trace]
        return matcher.match_trajectory(trace_tuples, road_network_segments=road_segments)

    def get_tile_metadata(self, z: int, x: int, y: int) -> Dict[str, Any]:
        return self.map_tile_engine.render_tile_metadata(x, y, z)

    def get_lane_guidance(self, total_lanes: int = 4, maneuver_type: str = "TURN_LEFT") -> Dict[str, Any]:
        return self.lane_guidance_engine.generate_junction_lanes(total_lanes=total_lanes, maneuver_type=maneuver_type)

    def check_geofences(
        self,
        user_lat: float,
        user_lng: float,
        speed_kph: float = 0.0,
        active_geofences: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        return self.geofence_engine.check_geofences(
            user_lat=user_lat,
            user_lng=user_lng,
            speed_kph=speed_kph,
            active_geofences=active_geofences
        )

    def generate_isochrone(
        self,
        center_lat: float,
        center_lng: float,
        time_budget_seconds: int = 900,
        travel_mode: str = "driving",
        traffic_factor: float = 0.85,
        num_vertices: int = 12
    ) -> Dict[str, Any]:
        return self.isochrone_engine.generate_isochrone(
            center_lat=center_lat,
            center_lng=center_lng,
            time_budget_seconds=time_budget_seconds,
            travel_mode=travel_mode,
            traffic_factor=traffic_factor,
            num_vertices=num_vertices
        )

    def generate_multi_ring_isochrones(
        self,
        center_lat: float,
        center_lng: float,
        time_budgets_seconds: Optional[List[int]] = None,
        travel_mode: str = "driving"
    ) -> Dict[str, Any]:
        return self.isochrone_engine.generate_multi_ring_isochrones(
            center_lat=center_lat,
            center_lng=center_lng,
            time_budgets_seconds=time_budgets_seconds,
            travel_mode=travel_mode
        )

    def calculate_ev_energy(
        self,
        distance_km: float,
        elevation_gain_meters: float = 0.0,
        battery_capacity_kwh: float = 60.0,
        current_soc_percent: float = 80.0,
        vehicle_efficiency_wh_per_km: float = 150.0,
        ambient_temp_celsius: float = 30.0
    ) -> Dict[str, Any]:
        return self.ev_engine.calculate_energy_consumption(
            distance_km=distance_km,
            elevation_gain_meters=elevation_gain_meters,
            battery_capacity_kwh=battery_capacity_kwh,
            current_soc_percent=current_soc_percent,
            vehicle_efficiency_wh_per_km=vehicle_efficiency_wh_per_km,
            ambient_temp_celsius=ambient_temp_celsius
        )

    def plan_ev_charging_stops(
        self,
        route_distance_km: float,
        current_soc_percent: float,
        chargers_along_route: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        return self.ev_engine.plan_charging_stops(
            route_distance_km=route_distance_km,
            current_soc_percent=current_soc_percent,
            chargers_along_route=chargers_along_route or []
        )

    def propagate_dead_reckoning(
        self,
        last_known_lat: float,
        last_known_lng: float,
        last_known_heading: float,
        elapsed_seconds: float,
        accel_x: float = 0.0,
        accel_y: float = 0.2,
        accel_z: float = 9.81,
        gyro_yaw_deg_s: float = 0.0,
        wheel_speed_kph: Optional[float] = None,
        last_confidence_radius_m: float = 2.0
    ) -> Dict[str, Any]:
        return self.dead_reckoning_engine.propagate_state(
            last_known_lat=last_known_lat,
            last_known_lng=last_known_lng,
            last_known_heading=last_known_heading,
            elapsed_seconds=elapsed_seconds,
            accel_x=accel_x,
            accel_y=accel_y,
            accel_z=accel_z,
            gyro_yaw_deg_s=gyro_yaw_deg_s,
            wheel_speed_kph=wheel_speed_kph,
            last_confidence_radius_m=last_confidence_radius_m
        )

    def evaluate_monsoon_safety(
        self,
        rainfall_mm_per_hr: float = 0.0,
        underpasses_count: int = 0,
        recent_waterlogging_reports: int = 0
    ) -> Dict[str, Any]:
        return self.monsoon_engine.evaluate_route_monsoon_safety(
            rainfall_mm_per_hr=rainfall_mm_per_hr,
            underpasses_count=underpasses_count,
            recent_waterlogging_reports=recent_waterlogging_reports
        )

    def predict_traffic(
        self,
        hour_of_day: int,
        day_of_week: int = 0,
        rain_intensity_mm: float = 0.0,
        event_density: float = 0.0
    ) -> Dict[str, Any]:
        return self.traffic_engine.predict_congestion(
            hour_of_day=hour_of_day,
            day_of_week=day_of_week,
            rain_intensity_mm=rain_intensity_mm,
            event_density=event_density
        )

    def recommend_optimal_departure(
        self,
        target_departure_hour: int,
        day_of_week: int = 0
    ) -> Dict[str, Any]:
        return self.traffic_engine.recommend_optimal_departure_time(
            target_departure_hour=target_departure_hour,
            day_of_week=day_of_week
        )
