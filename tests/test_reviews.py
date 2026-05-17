from datetime import datetime
from uuid import uuid4
from unittest.mock import MagicMock, AsyncMock
from app.db.models import Place, Review, User

def test_add_review(client, mock_db):
    # Mock Place loading or creation
    mock_place = Place(
        id=uuid4(),
        google_place_id="ChIJN1t_tDeuEmsRUsoyG83A16Y",
        name="Sydney Coffee Shop",
        address="123 George St, Sydney",
        location="POINT(151.2093 -33.8688)",
        rating=4,
        user_ratings_total=1
    )
    
    # Mock stats response for recalculation
    mock_stats = MagicMock()
    mock_stats.avg_rating = 4.5
    mock_stats.total_ratings = 2
    
    # Mock the SQLAlchemy executers
    mock_res_first = MagicMock()
    mock_res_first.scalars = MagicMock(return_value=MagicMock(first=MagicMock(return_value=mock_place)))
    
    mock_res_stats = MagicMock()
    mock_res_stats.first = MagicMock(return_value=mock_stats)
    
    mock_res_user = MagicMock()
    mock_res_user.scalars = MagicMock(return_value=MagicMock(first=MagicMock(return_value=User(email="test@example.com"))))
    
    mock_db.execute.side_effect = [
        mock_res_first,  # get_or_create_place first check
        mock_res_stats,  # stats recalculation check
        mock_res_user    # user fetch
    ]

    
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
    
    mock_review = Review(
        id=uuid4(),
        user_id=uuid4(),
        place_id=mock_place.id,
        rating=5,
        comment="Awesome place!",
        created_at=datetime.utcnow()
    )

    
    mock_res_place = MagicMock()
    mock_res_place.scalars = MagicMock(return_value=MagicMock(first=MagicMock(return_value=mock_place)))
    
    # Result rows for get reviews (Review object and Email string)
    mock_res_reviews = [
        (mock_review, "reviewer@example.com")
    ]
    
    mock_db.execute.side_effect = [
        mock_res_place,
        mock_res_reviews
    ]
    
    response = client.get("/api/v1/reviews/place/ChIJN1t_tDeuEmsRUsoyG83A16Y")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["comment"] == "Awesome place!"
    assert data[0]["reviewer_name"] == "reviewer"
