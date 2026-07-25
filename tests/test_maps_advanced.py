import pytest

def test_ar_real_life_navigation(client):
    payload = {
        "current_lat": 22.5726,
        "current_lng": 88.3639,
        "heading": 120.0,
        "camera_fov_horizontal": 68.0,
        "destination": "Park Street Station Gate 1"
    }
    response = client.post("/api/v1/maps/ar-navigation", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["ar_supported"] is True
    assert data["active_mode"] == "OUTDOOR_WALKING_AR"
    assert "camera_calibration" in data
    assert len(data["markers"]) >= 3
    # Check 3D screen space coordinates and depth
    marker_types = [m["marker_type"] for m in data["markers"]]
    assert "DIRECTIONAL_ARROW" in marker_types
    assert "LANDMARK_LABEL" in marker_types
    assert "DESTINATION_PIN" in marker_types
    assert data["markers"][0]["depth_z_meters"] > 0.0


def test_panorama_street_view(client):
    response = client.get("/api/v1/maps/panoramas/view?lat=22.5726&lng=88.3639&heading=90.0&pitch=0.0")
    assert response.status_code == 200
    data = response.json()
    assert "pano_id" in data
    assert data["lat"] == 22.5726
    assert data["lng"] == 88.3639
    assert "tile_url_template" in data
    assert len(data["historical_captures"]) > 0
    assert len(data["connected_hotspots"]) > 0


def test_indoor_panorama_tour(client):
    response = client.get("/api/v1/maps/panoramas/indoor-tour?venue_name=South+City+Mall&floor_level=2")
    assert response.status_code == 200
    data = response.json()
    assert data["venue_name"] == "South City Mall"
    assert data["current_floor"] == 2
    assert len(data["panoramas"]) > 0
    assert "connected_hotspots" in data["panoramas"][0]


def test_3d_maps_cityscape(client):
    response = client.get("/api/v1/maps/3d-cityscape?city=Kolkata&lat=22.5726&lng=88.3639&radius_meters=2000&detail_level=LOD2")
    assert response.status_code == 200
    data = response.json()
    assert data["city_name"] == "Kolkata"
    assert "KolkataCity_3D_Isometric" in data["perspective"]
    assert data["buildings_count"] >= 3
    assert len(data["buildings"]) >= 3
    # Verify building footprint extrusions
    building = data["buildings"][0]
    assert building["height_meters"] > 0.0
    assert "roof_type" in building
    assert len(building["coordinates_polygon"]) >= 4
    assert "camera_preset" in data
