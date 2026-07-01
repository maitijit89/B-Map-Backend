import pytest
from uuid import uuid4

def test_splash_ads_config(client):
    response = client.get("/api/v1/auth/splash-ads")
    assert response.status_code == 200
    data = response.json()
    assert data["show_ads"] is False
    assert "permanently removed" in data["message"]

def test_convert_coordinates(client):
    # WGS-84 to BD-09 Conversion
    response = client.get("/api/v1/maps/convert-coordinates?lat=39.9042&lng=116.4074&from_sys=WGS84&to_sys=BD09")
    assert response.status_code == 200
    data = response.json()
    assert data["from_system"] == "WGS84"
    assert data["to_system"] == "BD09"
    # Ensure there is a Baidu coordinate shift
    assert data["converted_lat"] != 39.9042
    assert data["converted_lng"] != 116.4074

def test_get_3d_metadata(client):
    # Supported city
    response = client.get("/api/v1/maps/3d-metadata?city=Beijing")
    assert response.status_code == 200
    data = response.json()
    assert data["is_3d_view_supported"] is True
    assert "LOD1" in data["lod_levels"]

    # Unsupported city
    response = client.get("/api/v1/maps/3d-metadata?city=Paris")
    assert response.status_code == 200
    data = response.json()
    assert data["is_3d_view_supported"] is False

def test_get_indoor_map(client):
    response = client.get("/api/v1/maps/indoor?location_name=CentralStation")
    assert response.status_code == 200
    data = response.json()
    assert "floors" in data
    assert len(data["floors"]) > 0

def test_get_streetview_panoramas(client):
    response = client.get("/api/v1/maps/panoramas?lat=39.9042&lng=116.4074")
    assert response.status_code == 200
    data = response.json()
    assert "historical_captures" in data
    # Verify Time machine captures exist and fleet sensors are detailed
    assert len(data["historical_captures"]) > 0
    assert "fleet_metadata" in data

def test_voice_query_wake_word(client):
    # Missing wake word
    response = client.post("/api/v1/voice/query", json={"query": "Calculate route to Beijing"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "Missing wake word" in data["error"]

    # Valid wake word
    response = client.post("/api/v1/voice/query", json={"query": "Gemini ai, calculate route to Shanghai Station"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["intent"] == "NAVIGATION"
    assert "speech_response" in data

def test_navigation_extensions(client):
    # Cycling specific check in Bengaluru (supported Indian city)
    response = client.get("/api/v1/navigation/directions?origin=12.9716,77.5946&destination=13.0827,80.2707&mode=cycling")
    assert response.status_code == 200
    data = response.json()
    assert data["routes"][0]["cycling_lane_details"]["is_lane_level_enabled"] is True

    # Cycling specific check in New York (unsupported city)
    response = client.get("/api/v1/navigation/directions?origin=40.7128,-74.0060&destination=40.7306,-73.9352&mode=cycling")
    assert response.status_code == 200
    data = response.json()
    assert data["routes"][0]["cycling_lane_details"]["is_lane_level_enabled"] is False

    # Transit subway carriage details
    response = client.get("/api/v1/navigation/directions?origin=39.9042,116.4074&destination=39.9142,116.4174&mode=transit&transit_preference=fewest_transfers")
    assert response.status_code == 200
    data = response.json()
    assert "transit_details" in data["routes"][0]
    assert data["routes"][0]["transit_details"]["subway_carriage_recommendation"]["best_carriage"] == "Car 4, Door 2"

def test_lane_guidance_and_parking(client):
    response = client.get("/api/v1/navigation/lane-guidance?origin=39.9042,116.4074&destination=39.9142,116.4174")
    assert response.status_code == 200
    data = response.json()
    assert data["supported"] is True
    assert len(data["steps"]) > 0

    response = client.get("/api/v1/navigation/parking?lat=39.9042&lng=116.4074")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert "available_spots" in data[0]

def test_predictive_traffic_and_ar(client):
    response = client.get("/api/v1/navigation/predictive-traffic?origin=Beijing&destination=Tianjin")
    assert response.status_code == 200
    data = response.json()
    assert "recommended_routes" in data

    response = client.get("/api/v1/navigation/ar-overlay?route_id=route-123&location=39.9042,116.4074")
    assert response.status_code == 200
    data = response.json()
    assert len(data["overlay_instructions"]) > 0

def test_lifestyle_services(client):
    # Price comparison
    response = client.get("/api/v1/lifestyle/ride-hailing/compare?origin=Hotel&destination=Station")
    assert response.status_code == 200
    data = response.json()
    providers = [d["provider"] for d in data]
    assert "CaoCao" in providers
    assert "DiDi" in providers

    # Book ride
    payload = {"provider": "CaoCao", "service_type": "Premium EV", "origin": "Hotel", "destination": "Station"}
    response = client.post("/api/v1/lifestyle/ride-hailing/book", json=payload)
    assert response.status_code == 201
    assert response.json()["status"] == "CONFIRMED"

    # Trip.com restaurants
    response = client.get("/api/v1/lifestyle/partner/restaurants?query=duck&lat=39.9042&lng=116.4074")
    assert response.status_code == 200
    assert "Trip.com Verified Partner" in response.json()[0]["partner_logo"]

    # Trip.com hotel booking
    hotel_payload = {"hotel_id": "hotel-999", "check_in": "2026-07-10", "check_out": "2026-07-12", "room_type": "Deluxe King"}
    response = client.post("/api/v1/lifestyle/partner/hotels/book", json=hotel_payload)
    assert response.status_code == 201
    assert response.json()["partner"] == "Trip.com Booking Engine"

    # Nearby search (charging station & bike sharing)
    response = client.get("/api/v1/lifestyle/nearby?lat=39.9042&lng=116.4074&type=charging_station")
    assert response.status_code == 200
    assert "connectors_available" in response.json()[0]

    response = client.get("/api/v1/lifestyle/nearby?lat=39.9042&lng=116.4074&type=bike_sharing")
    assert response.status_code == 200
    assert "bikes_available" in response.json()[0]

def test_car_and_watch_sync(client):
    payload = {
        "device_id": "vehicle_volvo_v20_xyz",
        "device_type": "car",
        "active_route": {"route_id": "rt-888"},
        "favorites": ["Beijing Mall", "Office"]
    }
    response = client.post("/api/v1/car-sync/session", json=payload)
    assert response.status_code == 200
    assert response.json()["sync_status"] == "SYNCHRONIZED"

    response = client.get("/api/v1/car-sync/mirror?device_id=vehicle_volvo_v20_xyz")
    assert response.status_code == 200
    assert response.json()["active"] is True

    response = client.get("/api/v1/car-sync/watch?device_id=watch_harmonyos_123")
    assert response.status_code == 200
    assert response.json()["is_standalone_navigation_active"] is True

def test_offline_maps(client):
    response = client.get("/api/v1/offline/cities")
    assert response.status_code == 200
    assert any(c["city_id"] == "beijing" for c in response.json())

    response = client.get("/api/v1/offline/download?city_id=beijing")
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert "download_url" in response.json()

def test_government_meteorological_feeds(client):
    response = client.get("/api/v1/environment/gov-feeds?lat=18.5204&lng=73.8567")
    assert response.status_code == 200
    data = response.json()
    assert "traffic_feed" in data
    assert "meteorological_feed" in data

def test_accessibility_blind_navigation(client):
    response = client.get("/api/v1/accessibility/blind-navigation?lat=39.9042&lng=116.4074&destination=BeijingStation")
    assert response.status_code == 200
    data = response.json()
    assert data["spatial_audio_mode"] == "Binaural Haptic Feedback"
    assert len(data["turn_by_turn_instructions"]) > 0

def test_user_me_profile_gamification(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert "user" in data
    assert "gamification" in data
    assert "level" in data["gamification"]
    assert "xp" in data["gamification"]
    assert "badges" in data["gamification"]

def test_hindi_localization(client):
    # Search text in Hindi
    response = client.get("/api/v1/places/search-text?q=office&lang=hi")
    assert response.status_code == 200
    data = response.json()
    assert "गूगल क्लाउड कार्यालय" in data["places"][0]["displayName"]["text"]

    # Details in Hindi
    response = client.get("/api/v1/places/details/googleplex?lang=hi")
    assert response.status_code == 200
    data = response.json()
    assert data["result"]["name"] == "गूगलप्लेक्स"

    # Directions in Hindi
    response = client.get("/api/v1/navigation/directions?origin=39.9042,116.4074&destination=39.9142,116.4174&mode=driving&lang=hi")
    assert response.status_code == 200
    data = response.json()
    assert data["routes"][0]["summary"] == "मेन सेंट के माध्यम से मॉक रूट"

def test_cab_aggregator(client):
    # Quote/Compare
    response = client.get("/api/v1/cabs/quote?origin=Airport&destination=Hotel")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert data[0]["provider"] in ["Uber", "Ola", "Rapido"]

    # Book cab
    payload = {"quote_id": "uber_quote_g1", "provider": "Uber", "service_type": "UberGo"}
    response = client.post("/api/v1/cabs/book", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "ACCEPTED"
    assert "Rajesh Kumar" in data["driver_name"]

def test_live_transit(client):
    response = client.get("/api/v1/transit/live-bus?lat=28.6139&lng=77.2090")
    assert response.status_code == 200
    data = response.json()
    assert "buses" in data
    assert "metro_trains" in data
    assert len(data["buses"]) > 0

def test_dynamic_slot_availability(client):
    # EV Charger slots
    response = client.get("/api/v1/places/ev-charge-station-1/slots")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "EV_CHARGER"
    assert data["available_slots"] == 3

    # Parking slots
    response = client.get("/api/v1/places/parking-mall-2/availability")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "PARKING"
    assert data["available_slots"] == 33

def test_commute_shortcuts(client):
    # Save shortcut
    payload = {"name": "Home", "address": "123 Street Delhi", "lat": 28.6139, "lng": 77.2090}
    response = client.post("/api/v1/users/shortcuts", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "SAVED"

    # Get shortcuts with ETA
    response = client.get("/api/v1/users/shortcuts?current_location=28.62,77.21")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert "commute_eta" in data[0]

def test_nearby_lifestyle_feed(client):
    response = client.get("/api/v1/places/nearby/feed?lat=39.9042&lng=116.4074&radius=3000&lang=en")
    assert response.status_code == 200
    data = response.json()
    assert "feed_items" in data
    assert data["total_items"] > 0
    assert data["feed_items"][0]["rating"] >= 4.0
