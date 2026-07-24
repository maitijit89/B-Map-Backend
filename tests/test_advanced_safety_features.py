import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.shared.dependencies import get_current_user
from app.features.auth.models import User

async def override_get_current_user():
    user = User(
        id="test_user_123",
        email="test@example.com",
        display_name="Test User",
        password_hash="hash",
        is_active=True
    )
    return user

app.dependency_overrides[get_current_user] = override_get_current_user

def test_safety_contacts(client: TestClient):
    response = client.get("/api/v1/safety/contacts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_enforcement_nearby(client: TestClient):
    response = client.get("/api/v1/enforcement/nearby?lat=28.6&lng=77.2")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_carpool_matches(client: TestClient):
    payload = {
        "origin": "Noida",
        "destination": "Gurugram",
        "desired_departure_time": "2026-08-01T08:00:00Z",
        "seats_needed": 1
    }
    response = client.post("/api/v1/carpool/matches", json=payload)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
