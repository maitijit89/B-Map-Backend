def test_compute_routes(client):
    payload = {
        "origin": {"location": {"latLng": {"latitude": 37.42, "longitude": -122.08}}},
        "destination": {"location": {"latLng": {"latitude": 37.43, "longitude": -122.09}}},
        "travel_mode": "DRIVE",
        "routing_preference": "TRAFFIC_AWARE"
    }
    response = client.post("/api/v1/navigation/compute-routes", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "routes" in data
    assert len(data["routes"]) > 0
    assert "duration" in data["routes"][0]

def test_distance_matrix(client):
    response = client.get("/api/v1/navigation/distance-matrix?origins=37.42,-122.08&destinations=37.43,-122.09&mode=driving")
    assert response.status_code == 200
    data = response.json()
    assert "rows" in data
    assert "destination_addresses" in data
    assert data["status"] == "OK"

def test_optimize_routes(client):
    payload = {
        "model": {
            "shipments": [],
            "vehicles": []
        }
    }
    response = client.post("/api/v1/navigation/optimize-routes", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "routes" in data
    assert "metrics" in data

def test_snap_to_roads(client):
    response = client.get("/api/v1/navigation/snap-to-roads?path=37.42,-122.08|37.43,-122.09")
    assert response.status_code == 200
    data = response.json()
    assert "snappedPoints" in data
    assert len(data["snappedPoints"]) > 0

def test_speed_limits(client):
    response = client.get("/api/v1/navigation/speed-limits?path=37.42,-122.08|37.43,-122.09")
    assert response.status_code == 200
    data = response.json()
    assert "speedLimits" in data
    assert len(data["speedLimits"]) > 0
