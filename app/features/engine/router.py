from fastapi import APIRouter, Depends, Query, Path, status
from typing import List, Dict, Any, Optional
from app.features.engine.service import EngineService
from app.schemas.engine import (
    SpatialSearchRequest,
    GraphRoutingRequest,
    NavigationTrackRequest,
    MapMatchingRequest,
    LaneGuidanceRequest,
    GeofenceCheckRequest,
    IsochroneRequest,
    MultiRingIsochroneRequest,
    EVEnergyRequest,
    EVChargingPlannerRequest,
    DeadReckoningRequest,
    MonsoonSafetyRequest,
    TrafficPredictionRequest,
    OptimalDepartureRequest
)

router = APIRouter()
service = EngineService()

@router.get("/status", summary="Core Engines Health Status")
async def get_engine_status():
    """
    Returns operational health status of all 12 core engines in B-Map Backend.
    """
    return {
        "status": "HEALTHY",
        "engines_registered_count": 12,
        "engines": [
            "SpatialSearchEngine",
            "AStarRoutingEngine",
            "TurnByTurnNavigationEngine",
            "HiddenMarkovMapMatcher",
            "MapTileEngine",
            "LaneGuidanceEngine",
            "SpatialGeofenceEngine",
            "IsochroneEngine",
            "EVEnergyRoutingEngine",
            "DeadReckoningEngine",
            "MonsoonSafetyEngine",
            "PredictiveTrafficEngine"
        ]
    }

@router.post("/search", summary="Spatial Search & Fuzzy Ranking Engine")
async def spatial_search_endpoint(payload: SpatialSearchRequest):
    """
    Ranks places using Levenshtein fuzzy string similarity, Haversine spatial proximity decay, and place rating scores.
    """
    return service.rank_places(
        query=payload.query,
        places=payload.places,
        user_lat=payload.user_lat,
        user_lng=payload.user_lng,
        max_results=payload.max_results
    )

@router.post("/routing", summary="A* Shortest Path Graph Routing Engine")
async def graph_routing_endpoint(payload: GraphRoutingRequest):
    """
    Calculates multi-criteria shortest or fastest path over a custom road network graph using A* algorithm.
    """
    return service.compute_graph_route(
        nodes=payload.nodes,
        edges=payload.edges,
        start_id=payload.start_id,
        goal_id=payload.goal_id,
        criteria=payload.criteria
    )

@router.post("/navigation/track", summary="Turn-by-Turn Guidance & Off-Route Engine")
async def navigation_track_endpoint(payload: NavigationTrackRequest):
    """
    Snaps position to active route, detects off-route deviation (>35m), and generates turn maneuvers and voice prompts.
    """
    return service.track_navigation_position(
        route_points=payload.route_points,
        user_lat=payload.user_lat,
        user_lng=payload.user_lng
    )

@router.post("/map-matching", summary="HMM Viterbi Map-Matching Engine")
async def map_matching_endpoint(payload: MapMatchingRequest):
    """
    Matches noisy GPS trajectories to street network edges using Hidden Markov Model (HMM) Viterbi algorithm.
    """
    return service.match_map_trajectory(
        gps_trace=payload.gps_trace,
        road_segments=payload.road_segments,
        sigma_z=payload.sigma_z,
        beta=payload.beta
    )

@router.get("/map-tile/{z}/{x}/{y}", summary="Slippy Map Tile & QuadKey Engine")
async def map_tile_endpoint(
    z: int = Path(..., ge=0, le=22, description="Zoom level"),
    x: int = Path(..., ge=0, description="Tile X coordinate"),
    y: int = Path(..., ge=0, description="Tile Y coordinate")
):
    """
    Converts tile (z, x, y) indices to QuadKeys, lat/lng bounding box, and vector tile rendering metadata.
    """
    return service.get_tile_metadata(z=z, x=x, y=y)

@router.post("/lane-guidance", summary="Junction & Multi-Lane Guidance Engine")
async def lane_guidance_endpoint(payload: LaneGuidanceRequest):
    """
    Calculates lane positioning for multi-lane Indian highways, flyover splits, and junction interchanges.
    """
    return service.get_lane_guidance(
        total_lanes=payload.total_lanes,
        maneuver_type=payload.maneuver_type
    )

@router.post("/geofence/check", summary="Spatial Ray-Casting Geofence Alert Engine")
async def geofence_check_endpoint(payload: GeofenceCheckRequest):
    """
    Performs high-performance point-in-polygon containment checks and evaluates speed & hazard alert triggers.
    """
    return service.check_geofences(
        user_lat=payload.user_lat,
        user_lng=payload.user_lng,
        speed_kph=payload.speed_kph,
        active_geofences=payload.active_geofences
    )

@router.post("/isochrone", summary="Isochrone Reachable Area Polygon Engine")
async def isochrone_endpoint(payload: IsochroneRequest):
    """
    Generates time-budget reachable polygon boundaries accounting for travel mode, speed, and traffic conditions.
    """
    return service.generate_isochrone(
        center_lat=payload.center_lat,
        center_lng=payload.center_lng,
        time_budget_seconds=payload.time_budget_seconds,
        travel_mode=payload.travel_mode,
        traffic_factor=payload.traffic_factor,
        num_vertices=payload.num_vertices
    )

@router.post("/isochrone/multi-ring", summary="Multi-Ring Isochrone Contours Engine")
async def multi_ring_isochrone_endpoint(payload: MultiRingIsochroneRequest):
    """
    Generates multi-ring travel time contour rings (e.g. 5, 10, 15, 30 mins) for urban accessibility mapping.
    """
    return service.generate_multi_ring_isochrones(
        center_lat=payload.center_lat,
        center_lng=payload.center_lng,
        time_budgets_seconds=payload.time_budgets_seconds,
        travel_mode=payload.travel_mode
    )

@router.post("/ev-energy", summary="EV Energy Consumption Engine")
async def ev_energy_endpoint(payload: EVEnergyRequest):
    """
    Predicts EV battery SoC consumption considering trip distance, elevation climb, temperature AC load, and efficiency.
    """
    return service.calculate_ev_energy(
        distance_km=payload.distance_km,
        elevation_gain_meters=payload.elevation_gain_meters,
        battery_capacity_kwh=payload.battery_capacity_kwh,
        current_soc_percent=payload.current_soc_percent,
        vehicle_efficiency_wh_per_km=payload.vehicle_efficiency_wh_per_km,
        ambient_temp_celsius=payload.ambient_temp_celsius
    )

@router.post("/ev-energy/charging-planner", summary="EV En-Route Charging Planner Engine")
async def ev_charging_planner_endpoint(payload: EVChargingPlannerRequest):
    """
    Plans en-route charging stops along a route when projected SoC drops below safety threshold (15%).
    """
    return service.plan_ev_charging_stops(
        route_distance_km=payload.route_distance_km,
        current_soc_percent=payload.current_soc_percent,
        chargers_along_route=payload.chargers_along_route
    )

@router.post("/dead-reckoning", summary="INS & Extended Kalman Filter Dead Reckoning Engine")
async def dead_reckoning_endpoint(payload: DeadReckoningRequest):
    """
    Propagates vehicle position, heading, and expanding confidence radius during GPS signal loss (tunnels/underground).
    """
    return service.propagate_dead_reckoning(
        last_known_lat=payload.last_known_lat,
        last_known_lng=payload.last_known_lng,
        last_known_heading=payload.last_known_heading,
        elapsed_seconds=payload.elapsed_seconds,
        accel_x=payload.accel_x,
        accel_y=payload.accel_y,
        accel_z=payload.accel_z,
        gyro_yaw_deg_s=payload.gyro_yaw_deg_s,
        wheel_speed_kph=payload.wheel_speed_kph,
        last_confidence_radius_m=payload.last_confidence_radius_m
    )

@router.post("/monsoon-safety", summary="Monsoon & Waterlogging Road Safety Engine")
async def monsoon_safety_endpoint(payload: MonsoonSafetyRequest):
    """
    Evaluates real-time monsoon rainfall intensity, low-lying underpass exposure, and waterlogging report risks.
    """
    return service.evaluate_monsoon_safety(
        rainfall_mm_per_hr=payload.rainfall_mm_per_hr,
        underpasses_count=payload.underpasses_count,
        recent_waterlogging_reports=payload.recent_waterlogging_reports
    )

@router.post("/traffic/prediction", summary="AI Predictive Traffic Forecast Engine")
async def traffic_prediction_endpoint(payload: TrafficPredictionRequest):
    """
    Forecasts congestion index, predicted speeds, and delay multipliers based on time of day, day of week, and weather.
    """
    return service.predict_traffic(
        hour_of_day=payload.hour_of_day,
        day_of_week=payload.day_of_week,
        rain_intensity_mm=payload.rain_intensity_mm,
        event_density=payload.event_density
    )

@router.post("/traffic/optimal-departure", summary="Optimal Departure Time Recommendation Engine")
async def optimal_departure_endpoint(payload: OptimalDepartureRequest):
    """
    Evaluates travel variance across a +/- 60 minute departure window to recommend the optimal lowest-congestion time.
    """
    return service.recommend_optimal_departure(
        target_departure_hour=payload.target_departure_hour,
        day_of_week=payload.day_of_week
    )
