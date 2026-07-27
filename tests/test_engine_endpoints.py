import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_engine_status_endpoint():
    response = client.get("/api/v1/engine/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert data["engines_registered_count"] == 12
    assert "SpatialSearchEngine" in data["engines"]

def test_spatial_search_endpoint():
    payload = {
        "query": "Connaught Place",
        "places": [
            {"name": "Connaught Place Circle", "lat": 28.6315, "lng": 77.2167, "rating": 4.8},
            {"name": "India Gate Park", "lat": 28.6129, "lng": 77.2295, "rating": 4.9}
        ],
        "user_lat": 28.6300,
        "user_lng": 77.2100,
        "max_results": 5
    }
    response = client.post("/api/v1/engine/search", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "Connaught Place Circle"
    assert "search_rank_score" in data[0]

def test_graph_routing_endpoint():
    payload = {
        "nodes": [
            {"id": "A", "lat": 28.6300, "lng": 77.2100},
            {"id": "B", "lat": 28.6320, "lng": 77.2150},
            {"id": "C", "lat": 28.6350, "lng": 77.2200}
        ],
        "edges": [
            {"u": "A", "v": "B", "speed_kph": 60.0},
            {"u": "B", "v": "C", "speed_kph": 60.0}
        ],
        "start_id": "A",
        "goal_id": "C",
        "criteria": "fastest"
    }
    response = client.post("/api/v1/engine/routing", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert data["path_nodes_count"] == 3
    assert data["total_distance_meters"] > 0

def test_navigation_track_endpoint():
    payload = {
        "route_points": [
            {"lat": 28.6300, "lng": 77.2100},
            {"lat": 28.6320, "lng": 77.2150},
            {"lat": 28.6350, "lng": 77.2200}
        ],
        "user_lat": 28.6301,
        "user_lng": 77.2101
    }
    response = client.post("/api/v1/engine/navigation/track", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ON_ROUTE"
    assert data["re_route_required"] is False
    assert "voice_prompt" in data

def test_map_matching_endpoint():
    payload = {
        "gps_trace": [
            [22.5532, 88.3522],
            [22.5538, 88.3528],
            [22.5555, 88.3538]
        ],
        "sigma_z": 10.0,
        "beta": 5.0
    }
    response = client.post("/api/v1/engine/map-matching", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["points_count"] == 3
    assert len(data["matched_path"]) == 3

def test_map_tile_endpoint():
    response = client.get("/api/v1/engine/map-tile/14/9240/6120")
    assert response.status_code == 200
    data = response.json()
    assert data["zoom"] == 14
    assert data["tile_x"] == 9240
    assert data["tile_y"] == 6120
    assert "quadkey" in data
    assert "bounding_box" in data

def test_lane_guidance_endpoint():
    payload = {
        "total_lanes": 4,
        "maneuver_type": "TURN_LEFT"
    }
    response = client.post("/api/v1/engine/lane-guidance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_lanes"] == 4
    assert 0 in data["recommended_lane_indices"]
    assert len(data["lanes"]) == 4

def test_geofence_check_endpoint():
    payload = {
        "user_lat": 28.6020,
        "user_lng": 77.2020,
        "speed_kph": 45.0
    }
    response = client.post("/api/v1/engine/geofence/check", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert data["inside_geofences_count"] >= 1
    assert data["has_active_alerts"] is True
    assert len(data["triggered_alerts"]) >= 1

def test_isochrone_endpoint():
    payload = {
        "center_lat": 22.5726,
        "center_lng": 88.3639,
        "time_budget_seconds": 900,
        "travel_mode": "driving"
    }
    response = client.post("/api/v1/engine/isochrone", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert data["time_budget_minutes"] == 15.0
    assert len(data["isochrone_polygon"]) > 5

def test_multi_ring_isochrone_endpoint():
    payload = {
        "center_lat": 22.5726,
        "center_lng": 88.3639,
        "time_budgets_seconds": [300, 600, 900],
        "travel_mode": "driving"
    }
    response = client.post("/api/v1/engine/isochrone/multi-ring", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert data["rings_count"] == 3

def test_ev_energy_endpoint():
    payload = {
        "distance_km": 25.0,
        "elevation_gain_meters": 150.0,
        "battery_capacity_kwh": 60.0,
        "current_soc_percent": 80.0
    }
    response = client.post("/api/v1/engine/ev-energy", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["consumed_kwh"] > 0.0
    assert "remaining_soc_percent" in data

def test_ev_charging_planner_endpoint():
    payload = {
        "route_distance_km": 450.0,
        "current_soc_percent": 40.0
    }
    response = client.post("/api/v1/engine/ev-energy/charging-planner", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["charging_stops_count"] >= 1

def test_dead_reckoning_endpoint():
    payload = {
        "last_known_lat": 28.5500,
        "last_known_lng": 77.2500,
        "last_known_heading": 90.0,
        "elapsed_seconds": 15.0,
        "wheel_speed_kph": 60.0
    }
    response = client.post("/api/v1/engine/dead-reckoning", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "INS_DEAD_RECKONING_ACTIVE"
    assert data["estimated_heading_deg"] == 90.0

def test_monsoon_safety_endpoint():
    payload = {
        "rainfall_mm_per_hr": 30.0,
        "underpasses_count": 2,
        "recent_waterlogging_reports": 3
    }
    response = client.post("/api/v1/engine/monsoon-safety", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["safety_level"] == "HIGH_MONSOON_FLOOD_HAZARD"

def test_traffic_prediction_endpoint():
    payload = {
        "hour_of_day": 9,
        "day_of_week": 1,
        "rain_intensity_mm": 15.0
    }
    response = client.post("/api/v1/engine/traffic/prediction", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["congestion_index"] > 0.4
    assert "congestion_level" in data

def test_optimal_departure_endpoint():
    payload = {
        "target_departure_hour": 9,
        "day_of_week": 1
    }
    response = client.post("/api/v1/engine/traffic/optimal-departure", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "recommended_time" in data
    assert len(data["all_window_options"]) == 5
