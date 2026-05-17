from uuid import uuid4
from datetime import datetime
from unittest.mock import MagicMock
from app.db.models import Timeline

def test_log_location(client, mock_db):
    payload = {
        "lat": -33.8688,
        "lng": 151.2093
    }
    
    response = client.post("/api/v1/timeline/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["lat"] == -33.8688
    assert data["lng"] == 151.2093

def test_get_timeline_stats(client, mock_db):
    # Setup some historic locations to let Haversine distance calculate
    # Sydney Opera House to Sydney Harbour Bridge (approx 1.1 km)
    mock_row1 = MagicMock()
    mock_row1.lng = 151.2153
    mock_row1.lat = -33.8568
    mock_row1.timestamp = datetime.utcnow()
    
    mock_row2 = MagicMock()
    mock_row2.lng = 151.2093
    mock_row2.lat = -33.8523
    mock_row2.timestamp = datetime.utcnow()
    
    mock_result = MagicMock()
    mock_result.all.return_value = [mock_row1, mock_row2]
    
    mock_db.execute.return_value = mock_result
    
    response = client.get("/api/v1/timeline/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_distance_km"] > 0
    assert data["distinct_locations_count"] == 2
    assert data["active_days_count"] == 1
    assert len(data["most_visited_cluster"]) > 0
