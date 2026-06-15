from datetime import datetime, timezone
from tests.conftest import MockCursor

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
    mock_row1 = {
        "location": {"type": "Point", "coordinates": [151.2153, -33.8568]},
        "timestamp": datetime.now(timezone.utc)
    }
    
    mock_row2 = {
        "location": {"type": "Point", "coordinates": [151.2093, -33.8523]},
        "timestamp": datetime.now(timezone.utc)
    }
    
    # Configure the mock to return these documents chronologically
    mock_db.timeline.find.return_value = MockCursor([mock_row1, mock_row2])
    
    response = client.get("/api/v1/timeline/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_distance_km"] > 0
    assert data["distinct_locations_count"] == 2
    assert data["active_days_count"] == 1
    assert len(data["most_visited_cluster"]) > 0
