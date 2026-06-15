def test_create_tile_session(client):
    payload = {"map_type": "roadmap"}
    response = client.post("/api/v1/maps/tiles/session", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "session" in data

def test_get_elevation(client):
    response = client.get("/api/v1/maps/elevation?locations=37.42,-122.08|37.43,-122.09")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) > 0
    assert "elevation" in data["results"][0]

def test_get_aerial_view(client):
    response = client.get("/api/v1/maps/aerial-view?address=1600+Amphitheatre+Pkwy")
    assert response.status_code == 200
    data = response.json()
    assert "video" in data or "state" in data

def test_get_static_map(client):
    response = client.get("/api/v1/maps/static?center=37.42,-122.08&zoom=14&size=600x400")
    assert response.status_code == 200
    data = response.json()
    assert "url" in data

def test_get_street_view(client):
    response = client.get("/api/v1/maps/streetview?location=37.42,-122.08&size=600x400")
    assert response.status_code == 200
    data = response.json()
    assert "url" in data

def test_manage_datasets(client):
    # List
    response = client.get("/api/v1/maps/datasets")
    assert response.status_code == 200
    data = response.json()
    assert "datasets" in data

    # Create
    payload = {"display_name": "New Dataset"}
    response = client.post("/api/v1/maps/datasets", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "name" in data

    # Delete
    response = client.delete("/api/v1/maps/datasets/mock-dataset-new")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
