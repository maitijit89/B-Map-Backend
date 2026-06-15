from datetime import datetime, timezone
from uuid import uuid4
from app.db.models import Place, Review, User
from tests.conftest import MockCursor

def test_add_review(client, mock_db):
    # Mock Place loading or creation
    mock_place = Place(
        id=uuid4(),
        google_place_id="ChIJN1t_tDeuEmsRUsoyG83A16Y",
        name="Sydney Coffee Shop",
        address="123 George St, Sydney",
        location={"type": "Point", "coordinates": [151.2093, -33.8688]},
        rating=4,
        user_ratings_total=1
    )
    mock_db.places.find_one.return_value = mock_place.to_dict()
    
    # Recalculate average ratings mock response
    mock_db.reviews.aggregate.return_value = MockCursor([
        {"avg_rating": 4.5, "total_ratings": 2}
    ])
    
    # Mock user fetch
    mock_user = User(email="test@example.com")
    mock_db.users.find_one.return_value = mock_user.to_dict()
    
    payload = {
        "google_place_id": "ChIJN1t_tDeuEmsRUsoyG83A16Y",
        "place_name": "Sydney Coffee Shop",
        "place_address": "123 George St, Sydney",
        "lat": -33.8688,
        "lng": 151.2093,
        "rating": 5,
        "comment": "Best flat white in town!"
    }
    
    response = client.post("/api/v1/reviews/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["rating"] == 5
    assert data["comment"] == "Best flat white in town!"
    assert data["reviewer_name"] == "test"

def test_get_place_reviews(client, mock_db):
    mock_place = Place(
        id=uuid4(),
        google_place_id="ChIJN1t_tDeuEmsRUsoyG83A16Y",
        name="Sydney Coffee Shop",
        address="123 George St, Sydney"
    )
    mock_db.places.find_one.return_value = mock_place.to_dict()
    
    mock_review = Review(
        id=uuid4(),
        user_id=uuid4(),
        place_id=mock_place.id,
        rating=5,
        comment="Awesome place!",
        created_at=datetime.now(timezone.utc)
    )
    
    # Result document with lookup aggregation joined user
    mock_aggregation_result = {
        "_id": mock_review.id,
        "user_id": mock_review.user_id,
        "place_id": mock_review.place_id,
        "rating": mock_review.rating,
        "comment": mock_review.comment,
        "created_at": mock_review.created_at,
        "user_list": {
            "email": "reviewer@example.com",
            "display_name": "reviewer"
        }
    }
    
    mock_db.reviews.aggregate.return_value = MockCursor([mock_aggregation_result])
    
    response = client.get("/api/v1/reviews/place/ChIJN1t_tDeuEmsRUsoyG83A16Y")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["comment"] == "Awesome place!"
    assert data[0]["reviewer_name"] == "reviewer"
