def test_get_air_quality(client):
    response = client.get("/api/v1/environment/air-quality?lat=37.42&lng=-122.08")
    assert response.status_code == 200
    data = response.json()
    assert "indexes" in data

def test_get_pollen(client):
    response = client.get("/api/v1/environment/pollen?lat=37.42&lng=-122.08&days=1")
    assert response.status_code == 200
    data = response.json()
    assert "dailyInfo" in data

def test_get_weather_current(client):
    response = client.get("/api/v1/environment/weather?lat=37.42&lng=-122.08&query_type=current")
    assert response.status_code == 200
    data = response.json()
    assert "temperature" in data

def test_get_weather_forecast_daily(client):
    response = client.get("/api/v1/environment/weather?lat=37.42&lng=-122.08&query_type=forecast_daily")
    assert response.status_code == 200
    data = response.json()
    assert "forecasts" in data

def test_get_weather_forecast_hourly(client):
    response = client.get("/api/v1/environment/weather?lat=37.42&lng=-122.08&query_type=forecast_hourly")
    assert response.status_code == 200
    data = response.json()
    assert "forecasts" in data

def test_get_weather_history(client):
    response = client.get("/api/v1/environment/weather?lat=37.42&lng=-122.08&query_type=history")
    assert response.status_code == 200
    data = response.json()
    assert "history" in data

def test_get_solar(client):
    response = client.get("/api/v1/environment/solar?lat=37.42&lng=-122.08")
    assert response.status_code == 200
    data = response.json()
    assert "solarPotential" in data
