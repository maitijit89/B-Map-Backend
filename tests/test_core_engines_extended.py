import pytest
from app.core.engine.map_matching_engine import HiddenMarkovMapMatcher
from app.core.engine.isochrone_engine import IsochroneEngine
from app.core.engine.dead_reckoning_engine import DeadReckoningEngine
from app.core.engine.geofence_alert_engine import SpatialGeofenceEngine, point_in_polygon

def test_hmm_map_matching_engine():
    matcher = HiddenMarkovMapMatcher()
    
    # Test emission probability formula
    p_exact = matcher.compute_emission_probability(0.0)
    p_far = matcher.compute_emission_probability(30.0)
    assert p_exact > p_far

    # Test trajectory matching
    gps_trace = [
        (22.5532, 88.3522),
        (22.5538, 88.3528),
        (22.5555, 88.3538)
    ]
    res = matcher.match_trajectory(gps_trace)
    assert res["status"] == "SUCCESS"
    assert res["points_count"] == 3
    assert len(res["matched_path"]) == 3
    assert res["overall_confidence_score"] > 0.0


def test_isochrone_engine():
    engine = IsochroneEngine()
    
    # Test single 15-minute driving isochrone
    iso = engine.generate_isochrone(22.5726, 88.3639, time_budget_seconds=900, travel_mode="driving")
    assert iso["status"] == "OK"
    assert iso["time_budget_minutes"] == 15.0
    assert iso["max_reachable_distance_meters"] > 0.0
    assert len(iso["isochrone_polygon"]) > 5

    # Test multi-ring contours
    multi = engine.generate_multi_ring_isochrones(22.5726, 88.3639, time_budgets_seconds=[300, 600, 900])
    assert multi["status"] == "OK"
    assert multi["rings_count"] == 3
    assert multi["rings"][0]["time_budget_minutes"] == 5.0
    assert multi["rings"][2]["time_budget_minutes"] == 15.0


def test_dead_reckoning_engine():
    engine = DeadReckoningEngine()
    
    # Propagate state in tunnel for 20 seconds at 60 km/h heading east (90 deg)
    res = engine.propagate_state(
        last_known_lat=28.5500,
        last_known_lng=77.2500,
        last_known_heading=90.0,
        elapsed_seconds=20.0,
        wheel_speed_kph=60.0
    )
    assert res["status"] == "INS_DEAD_RECKONING_ACTIVE"
    assert res["estimated_lat"] != 0.0
    assert res["estimated_lng"] != 0.0
    assert res["estimated_heading_deg"] == 90.0
    assert res["confidence_radius_meters"] > 2.0


def test_spatial_geofence_engine():
    engine = SpatialGeofenceEngine()
    
    # Polygon around (22.5600, 88.3600)
    polygon = [
        [22.5500, 88.3500],
        [22.5700, 88.3500],
        [22.5700, 88.3700],
        [22.5500, 88.3700]
    ]
    assert point_in_polygon(22.5600, 88.3600, polygon) is True
    assert point_in_polygon(22.7000, 88.5000, polygon) is False

    # Check user containment inside Eco Zone (22.5600, 88.3600)
    res = engine.check_geofences(22.5600, 88.3600, speed_kph=40.0)
    assert res["status"] == "OK"
    assert res["inside_geofences_count"] >= 1
    assert res["has_active_alerts"] is True
    assert len(res["triggered_alerts"]) >= 1
