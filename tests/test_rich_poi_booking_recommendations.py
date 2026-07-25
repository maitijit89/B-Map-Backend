import pytest

def test_rich_poi_detail_endpoint(client):
    response = client.get("/api/v1/places/rich-poi/poi_rest_601")
    assert response.status_code == 200
    data = response.json()
    assert data["poi_id"] == "poi_rest_601"
    assert data["category"] == "restaurant"
    assert data["rating"] >= 4.5
    assert len(data["photos"]) > 0
    assert len(data["amenities"]) > 0
    assert len(data["popular_dishes_or_highlights"]) > 0
    assert data["wheelchair_accessible"] is True
    assert data["parking_available"] is True


def test_rich_poi_search_endpoint(client):
    response = client.get("/api/v1/places/rich-search?category=hotel&lat=22.5726&lng=88.3639&min_rating=4.5")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert data["total_found"] >= 1
    assert data["pois"][0]["category"] == "hotel"


def test_in_app_hotel_booking(client):
    payload = {
        "hotel_id": "poi_hotel_702",
        "check_in": "2026-08-01",
        "check_out": "2026-08-03",
        "room_type": "Heritage Executive Suite"
    }
    response = client.post("/api/v1/lifestyle/partner/hotels/book", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "booking_reference" in data
    assert data["status"] == "RESERVED"


def test_in_app_ride_hailing_booking(client):
    payload = {
        "provider": "CaoCao",
        "service_type": "Premium EV",
        "origin": "Park Street",
        "destination": "Howrah Station"
    }
    response = client.post("/api/v1/lifestyle/ride-hailing/book", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "booking_id" in data
    assert data["status"] == "CONFIRMED"
    assert "京A" in data["license_plate"] or data["license_plate"] != ""


def test_in_app_movie_ticket_booking(client):
    payload = {
        "cinema_id": "cinema_imax_01",
        "movie_title": "Avatar 3: The Seed Bearer",
        "showtime": "2026-07-26T19:30:00",
        "hall_name": "Screen 1 IMAX 3D",
        "seats": ["F12", "F13"]
    }
    response = client.post("/api/v1/lifestyle/booking/movie", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["booking_type"] == "MOVIE"
    assert data["status"] == "CONFIRMED"
    assert data["details"]["seats"] == ["F12", "F13"]
    assert data["total_amount_paid"] == 700.0
    assert "CINEMA-" in data["pnr_or_confirmation"]


def test_in_app_flight_and_train_booking(client):
    # Test Airline ticket booking
    flight_payload = {
        "ticket_type": "AIRLINE",
        "carrier_or_line": "Air India AI-502",
        "origin": "CCU",
        "destination": "BOM",
        "departure_time": "2026-08-10T10:00:00Z",
        "seat_class": "BUSINESS",
        "passenger_name": "Aarav Sharma",
        "passenger_id_passport": "P12345678"
    }
    resp_flight = client.post("/api/v1/lifestyle/booking/travel-tickets", json=flight_payload)
    assert resp_flight.status_code == 201
    data_flight = resp_flight.json()
    assert data_flight["booking_type"] == "AIRLINE_TICKET"
    assert "AIR-" in data_flight["pnr_or_confirmation"]

    # Test Train ticket booking
    train_payload = {
        "ticket_type": "TRAIN",
        "carrier_or_line": "Vande Bharat Express 20901",
        "origin": "Howrah Junction",
        "destination": "Puri",
        "departure_time": "2026-08-15T06:10:00Z",
        "seat_class": "EXECUTIVE_CHAIR",
        "passenger_name": "Aarav Sharma",
        "passenger_id_passport": "ID-987654"
    }
    resp_train = client.post("/api/v1/lifestyle/booking/travel-tickets", json=train_payload)
    assert resp_train.status_code == 201
    data_train = resp_train.json()
    assert data_train["booking_type"] == "TRAIN_TICKET"
    assert "RAIL-" in data_train["pnr_or_confirmation"]


def test_personalized_recommendations_engine(client):
    response = client.get("/api/v1/lifestyle/recommendations?user_id=usr_99&lat=22.5726&lng=88.3639&time_of_day=EVENING")
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "usr_99"
    assert data["time_of_day"] == "EVENING"
    assert len(data["recommended_bundles"]) >= 1
    assert len(data["items"]) >= 3
    assert data["items"][0]["match_score"] >= 0.90
