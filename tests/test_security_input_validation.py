import pytest

def test_extra_fields_forbidden_in_multimodal_request(client):
    # Payload contains an extra injected parameter "malicious_injection"
    payload = {
        "origin": "Park Street, Kolkata",
        "destination": "Airport, Kolkata",
        "allowed_modes": ["driving"],
        "malicious_injection": "DROP TABLE users;"
    }
    response = client.post("/api/v1/navigation/multimodal-plan", json=payload)
    # Should be rejected with 422 Unprocessable Entity due to extra="forbid"
    assert response.status_code == 422
    data = response.json()
    assert "extra_forbidden" in str(data["detail"]).lower() or "extra fields not permitted" in str(data["detail"]).lower() or "unpermitted" in str(data["detail"]).lower()


def test_out_of_bounds_latitude_rejected(client):
    # Invalid latitude 999.0
    payload = {
        "origin": "Park Street",
        "destination": "Airport",
        "current_lat": 999.0,  # Invalid! Latitude must be -90 to +90
        "current_lng": 88.3639,
        "heading": 180.0
    }
    response = client.post("/api/v1/navigation/lane-guidance/sensor-fusion", json=payload)
    assert response.status_code == 422


def test_out_of_bounds_heading_rejected(client):
    # Invalid heading 450.0 (must be 0-360)
    payload = {
        "current_lat": 22.5726,
        "current_lng": 88.3639,
        "heading": 450.0,
        "destination": "Park Street Station"
    }
    response = client.post("/api/v1/maps/ar-navigation", json=payload)
    assert response.status_code == 422


def test_extra_fields_forbidden_in_movie_booking(client):
    payload = {
        "cinema_id": "cinema_01",
        "movie_title": "Avatar 3",
        "showtime": "2026-07-26T20:00:00",
        "hall_name": "Screen 1",
        "seats": ["A1"],
        "admin_privileges_bypass": True  # Injected field!
    }
    response = client.post("/api/v1/lifestyle/booking/movie", json=payload)
    assert response.status_code == 422


def test_whitespace_stripping_and_valid_payload(client):
    # Extra whitespace surrounding strings should be automatically stripped
    payload = {
        "origin": "   Connaught Place, New Delhi   ",
        "destination": "   India Gate, New Delhi   ",
        "allowed_modes": ["driving", "walking"]
    }
    response = client.post("/api/v1/navigation/multimodal-plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["origin"] == "Connaught Place, New Delhi"
    assert data["destination"] == "India Gate, New Delhi"


def test_auth_extra_fields_rejected(client):
    payload = {
        "email": "testuser@bmap.io",
        "password": "Password123!",
        "is_admin_injected": True
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 422
