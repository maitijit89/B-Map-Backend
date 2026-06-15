def test_search_text(client):
    response = client.get("/api/v1/places/search-text?q=restaurant&lat=37.42&lng=-122.08")
    assert response.status_code == 200
    data = response.json()
    assert "places" in data
    assert len(data["places"]) > 0
    assert "id" in data["places"][0]

def test_geocode(client):
    response = client.get("/api/v1/places/geocode?address=1600+Amphitheatre+Pkwy")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) > 0
    assert data["results"][0]["formatted_address"] == "1600 Amphitheatre Pkwy"

def test_reverse_geocode(client):
    response = client.get("/api/v1/places/reverse-geocode?lat=37.4223&lng=-122.0841")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) > 0
    assert "formatted_address" in data["results"][0]

def test_validate_address(client):
    payload = {
        "address_lines": ["1600 Amphitheatre Pkwy"],
        "region_code": "US",
        "locality": "Mountain View"
    }
    response = client.post("/api/v1/places/validate-address", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "result" in data
    assert data["result"]["verdict"]["addressComplete"] is True

def test_geolocate(client):
    payload = {
        "cell_towers": [],
        "wifi_access_points": []
    }
    response = client.post("/api/v1/places/geolocate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "location" in data
    assert "lat" in data["location"]

def test_timezone(client):
    response = client.get("/api/v1/places/timezone?lat=37.42&lng=-122.08")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert data["timeZoneId"] == "America/Los_Angeles"

def test_aggregate(client):
    payload = {
        "lat": 37.42,
        "lng": -122.08,
        "radius": 1000,
        "place_types": ["restaurant"]
    }
    response = client.post("/api/v1/places/aggregate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "placeCount" in data
    assert "placeInsights" in data
