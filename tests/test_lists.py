from datetime import datetime, timezone
from uuid import uuid4
from app.db.models import UserList, Place
from tests.conftest import MockCursor

def test_create_list(client, mock_db):
    payload = {
        "name": "Weekend Road Trip",
        "is_public": True
    }
    
    response = client.post("/api/v1/lists/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Weekend Road Trip"
    assert data["is_public"] is True

def test_get_user_lists(client, mock_db):
    mock_list = UserList(
        id=uuid4(),
        user_id=uuid4(),
        name="Coffee Spots",
        is_public=False,
        created_at=datetime.now(timezone.utc),
        place_ids=[uuid4()] * 5 # list has 5 place IDs
    )
    
    mock_db.user_lists.find.return_value = MockCursor([mock_list.to_dict()])
    
    response = client.get("/api/v1/lists/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Coffee Spots"
    assert data[0]["places_count"] == 5

def test_add_place_to_list(client, mock_db):
    mock_list = UserList(
        id=uuid4(),
        user_id=uuid4(),
        name="Adventures",
        is_public=False
    )
    
    mock_place = Place(
        id=uuid4(),
        google_place_id="ChIJN1t_tDeuEmsRUsoyG83A16Y",
        name="Blue Mountains"
    )
    
    mock_db.user_lists.find_one.return_value = mock_list.to_dict()
    mock_db.places.find_one.return_value = mock_place.to_dict()
    
    list_id = mock_list.id
    payload = {
        "google_place_id": "ChIJN1t_tDeuEmsRUsoyG83A16Y",
        "name": "Blue Mountains",
        "address": "NSW, Australia",
        "lat": -33.7180,
        "lng": 150.3100
    }
    
    response = client.post(f"/api/v1/lists/{list_id}/places", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_get_list_details_private_denied(client, mock_db):
    # List owned by a different user
    mock_list = UserList(
        id=uuid4(),
        user_id=uuid4(), # Different owner
        name="Private Secrets",
        is_public=False
    )
    
    mock_db.user_lists.find_one.return_value = mock_list.to_dict()
    
    list_id = mock_list.id
    response = client.get(f"/api/v1/lists/{list_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "List not found or private access denied"
