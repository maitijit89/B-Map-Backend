from uuid import uuid4
from datetime import datetime, timezone
from app.db.models import Place, Incident, IncidentSeverity, IncidentType
from tests.conftest import MockCursor

def test_get_offline_cache(client, mock_db):
    mock_place = Place(
        id=uuid4(),
        google_place_id="ChIJN1t_tDeuEmsRUsoyG83A16Y",
        name="Bondi Beach Café",
        address="Campbell Parade, Bondi",
        rating=4,
        user_ratings_total=10,
        created_at=datetime.now(timezone.utc)
    )
    
    mock_incident = Incident(
        id=uuid4(),
        description="Road closure near beach: Fallen tree",
        type=IncidentType.TRAFFIC,
        severity=IncidentSeverity.MEDIUM,
        created_at=datetime.now(timezone.utc)
    )
    
    # Configure mock responses for places and incidents find queries
    place_doc = {
        "_id": mock_place.id,
        "google_place_id": mock_place.google_place_id,
        "name": mock_place.name,
        "address": mock_place.address,
        "location": {"type": "Point", "coordinates": [151.2743, -33.8908]},
        "rating": mock_place.rating,
        "user_ratings_total": mock_place.user_ratings_total,
        "created_at": mock_place.created_at
    }
    
    incident_doc = {
        "_id": mock_incident.id,
        "description": mock_incident.description,
        "type": mock_incident.type.value,
        "severity": mock_incident.severity.value,
        "location": {"type": "Point", "coordinates": [151.2720, -33.8890]},
        "created_at": mock_incident.created_at
    }
    
    mock_db.places.find.return_value = MockCursor([place_doc])
    mock_db.incidents.find.return_value = MockCursor([incident_doc])
    
    response = client.get("/api/v1/offline/cache?lat_min=-34.0&lng_min=151.0&lat_max=-33.0&lng_max=152.0")
    assert response.status_code == 200
    data = response.json()
    assert "places" in data
    assert "incidents" in data
    assert len(data["places"]) == 1
    assert data["places"][0]["name"] == "Bondi Beach Café"
    assert data["places"][0]["lng"] == 151.2743
    assert len(data["incidents"]) == 1
    assert data["incidents"][0]["description"] == "Road closure near beach: Fallen tree"
    assert data["incidents"][0]["lng"] == 151.2720
