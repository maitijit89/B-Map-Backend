import pytest

def test_multimodal_planning_endpoint(client):
    payload = {
        "origin": "Connaught Place, New Delhi",
        "destination": "Chhatrapati Shivaji Airport, Mumbai",
        "allowed_modes": ["driving", "walking", "cycling", "subway", "train", "airplane"],
        "preferences": {"avoid_tolls": False, "time_priority": True}
    }
    response = client.post("/api/v1/navigation/multimodal-plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert "recommended_itinerary" in data
    rec = data["recommended_itinerary"]
    assert rec["total_duration_seconds"] > 0
    assert len(rec["segments"]) >= 4
    # Verify combination of modes (driving, subway, airplane, walking)
    modes = [seg["mode"] for seg in rec["segments"]]
    assert "driving" in modes
    assert "subway" in modes
    assert "airplane" in modes
    assert "walking" in modes
    assert "alternative_itineraries" in data


def test_lane_level_navigation_sensor_fusion(client):
    payload = {
        "origin": "28.6139,77.2090",
        "destination": "28.4595,77.0266",
        "current_lat": 28.5200,
        "current_lng": 77.1500,
        "heading": 185.0,
        "current_lane_index": 2,
        "speed_kph": 65.0
    }
    response = client.post("/api/v1/navigation/lane-guidance/sensor-fusion", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["supported"] is True
    assert "active_lane_recommendation" in data
    assert len(data["lanes"]) == 4
    assert data["sensor_confidence"] >= 0.90
    assert data["high_precision_map_active"] is True
    assert "next_maneuver" in data


def test_realtime_traffic_and_dynamic_rerouting(client):
    # Case 1: Incident / Accident alert triggers dynamic reroute recommendation
    payload_incident = {
        "current_route_id": "rt-1004",
        "current_lat": 28.5355,
        "current_lng": 77.3910,
        "destination": "28.6139,77.2090",
        "current_speed_kph": 10.0,
        "traffic_event_alert": "accident"
    }
    response = client.post("/api/v1/navigation/dynamic-reroute", json=payload_incident)
    assert response.status_code == 200
    data = response.json()
    assert data["reroute_recommended"] is True
    assert data["time_saved_mins"] > 0
    assert "accident" in data["reason"].lower() or "congestion" in data["reason"].lower()

    # Case 2: Smooth flow does not force reroute
    payload_clear = {
        "current_route_id": "rt-1004",
        "current_lat": 28.5355,
        "current_lng": 77.3910,
        "destination": "28.6139,77.2090",
        "current_speed_kph": 60.0,
        "traffic_event_alert": None
    }
    resp_clear = client.post("/api/v1/navigation/dynamic-reroute", json=payload_clear)
    assert resp_clear.status_code == 200
    data_clear = resp_clear.json()
    assert data_clear["reroute_recommended"] is False


def test_customizable_preferences_endpoints(client):
    # 1. Get default preferences
    res_get = client.get("/api/v1/navigation/preferences?user_id=test_user_777")
    assert res_get.status_code == 200
    get_data = res_get.json()
    assert get_data["user_id"] == "test_user_777"
    assert "preferences" in get_data
    assert get_data["preferences"]["routing_priority"] == "time_priority"

    # 2. Update preferences
    update_payload = {
        "routing_priority": "time_priority",
        "avoid_tolls": True,
        "avoid_expressways": True,
        "avoid_ferries": False,
        "transit_preference": "least_walking",
        "preferred_vehicle_type": "suv"
    }
    res_put = client.put("/api/v1/navigation/preferences?user_id=test_user_777", json=update_payload)
    assert res_put.status_code == 200
    put_data = res_put.json()
    assert put_data["preferences"]["avoid_tolls"] is True
    assert put_data["preferences"]["avoid_expressways"] is True

    # 3. Verify directions query params respect preferences
    res_dir = client.get("/api/v1/navigation/directions?origin=Delhi&destination=Gurgaon&mode=driving&avoid_tolls=true&avoid_expressways=true&time_priority=true")
    assert res_dir.status_code == 200
    dir_data = res_dir.json()
    assert dir_data["status"] == "OK"


def test_weak_signal_navigation_dead_reckoning(client):
    payload = {
        "last_known_lat": 28.5500,
        "last_known_lng": 77.2500,
        "last_known_heading": 90.0,
        "elapsed_seconds": 30.0,
        "imu_telemetry": {
            "accel_x": 0.1,
            "accel_y": 0.5,
            "accel_z": 9.8,
            "gyro_yaw": 0.0,
            "wheel_speed_kph": 60.0,
            "timestamp_ms": 1721900000000
        },
        "tunnel_or_underground_id": "pragati_maidan_tunnel_01"
    }
    response = client.post("/api/v1/navigation/weak-signal-positioning", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["dead_reckoning_active"] is True
    assert data["positioning_source"] == "INS_DEAD_RECKONING_MAP_MATCH"
    assert data["estimated_lat"] != 0.0
    assert data["estimated_lng"] != 0.0
    assert data["confidence_radius_meters"] > 2.0
    assert data["estimated_tunnel_exit_seconds"] >= 0.0
