import pytest
from app.core.engine.search_engine import SpatialSearchEngine, haversine_distance, levenshtein_similarity
from app.core.engine.routing_engine import AStarRoutingEngine
from app.core.engine.navigation_engine import TurnByTurnNavigationEngine, calculate_bearing, determine_turn_maneuver
from app.core.engine.map_engine import MapTileEngine

def test_haversine_distance():
    # Distance between Connaught Place (Delhi) and India Gate (Delhi) is approx 2.3 km
    d = haversine_distance(28.6315, 77.2167, 28.6129, 77.2295)
    assert 2000 <= d <= 2600

def test_levenshtein_similarity():
    sim1 = levenshtein_similarity("Rajiv Chowk", "Rajiv Chowk")
    assert sim1 == 1.0
    sim2 = levenshtein_similarity("Rajiv Chowk", "Rajiv Chawk")
    assert sim2 > 0.8

def test_spatial_search_engine_ranking():
    engine = SpatialSearchEngine()
    places = [
        {"name": "Delhi Public School", "lat": 28.6000, "lng": 77.2000, "rating": 4.2},
        {"name": "Connaught Place Market", "lat": 28.6315, "lng": 77.2167, "rating": 4.8},
        {"name": "India Gate Circle", "lat": 28.6129, "lng": 77.2295, "rating": 4.9}
    ]
    ranked = engine.rank_places("Connaught Place", places, user_lat=28.6300, user_lng=77.2100)
    assert len(ranked) == 3
    assert ranked[0]["name"] == "Connaught Place Market"

def test_astar_routing_engine():
    router = AStarRoutingEngine()
    router.add_node("A", 28.6300, 77.2100)
    router.add_node("B", 28.6320, 77.2150)
    router.add_node("C", 28.6350, 77.2200)

    router.add_edge("A", "B", speed_limit_kph=60.0)
    router.add_edge("B", "C", speed_limit_kph=60.0)

    res = router.find_shortest_path("A", "C", criteria="fastest")
    assert res is not None
    assert res["status"] == "OK"
    assert res["path_nodes_count"] == 3
    assert res["total_distance_meters"] > 0

def test_turn_by_turn_navigation_engine():
    points = [
        {"lat": 28.6300, "lng": 77.2100},
        {"lat": 28.6320, "lng": 77.2150},
        {"lat": 28.6350, "lng": 77.2200}
    ]
    engine = TurnByTurnNavigationEngine(points)
    
    # Track position on route
    track = engine.track_position(28.6301, 77.2101)
    assert track["status"] == "ON_ROUTE"
    assert track["re_route_required"] is False

    # Track position off route
    track_off = engine.track_position(28.7000, 77.3000)
    assert track_off["status"] == "OFF_ROUTE"
    assert track_off["re_route_required"] is True

def test_map_tile_engine():
    tile_engine = MapTileEngine()
    x, y = tile_engine.latlng_to_tile(28.6139, 77.2090, 14)
    assert isinstance(x, int)
    assert isinstance(y, int)

    quadkey = tile_engine.tile_to_quadkey(x, y, 14)
    assert len(quadkey) == 14

    meta = tile_engine.render_tile_metadata(x, y, 14)
    assert meta["quadkey"] == quadkey
    assert "bounding_box" in meta
