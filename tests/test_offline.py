from uuid import uuid4
from datetime import datetime
from unittest.mock import MagicMock
from app.db.models import Place, Incident, IncidentSeverity, IncidentType

def test_get_offline_cache(client, mock_db):
    mock_place = Place(
        id=uuid4(),
        google_place_id="ChIJN1t_tDeuEmsRUsoyG83A16Y",
        name="Bondi Beach Café",
        address="Campbell Parade, Bondi",
        rating=4,
        user_ratings_total=10,
        created_at=datetime.utcnow()
    )
    
    class MockRow(tuple):
        def __new__(cls, obj, lng, lat):
            return super().__new__(cls, (obj,))
        def __init__(self, obj, lng, lat):
            self.lng = lng
            self.lat = lat

    mock_incident = Incident(
        id=uuid4(),
        description="Road closure near beach: Fallen tree",
        type=IncidentType.TRAFFIC,
        severity=IncidentSeverity.MEDIUM,
        created_at=datetime.utcnow()
    )
    
    # Executer chain:
    # 1. Fetch places in envelope
    # 2. Fetch incidents in envelope
    mock_res_places = [
        MockRow(mock_place, 151.2743, -33.8908)
    ]
    
    mock_res_incidents = [
        MockRow(mock_incident, 151.2720, -33.8890)
    ]
    
    mock_db.execute.side_effect = [
        mock_res_places,
        mock_res_incidents
    ]
    
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

