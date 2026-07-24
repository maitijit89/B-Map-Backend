import pytest
from app.core.engine.ai_traffic_prediction_engine import PredictiveTrafficEngine
from app.core.engine.lane_guidance_engine import LaneGuidanceEngine
from app.core.engine.ev_energy_routing_engine import EVEnergyRoutingEngine
from app.core.engine.safety_monsoon_engine import MonsoonSafetyEngine

def test_predictive_traffic_engine():
    engine = PredictiveTrafficEngine()
    # Test morning rush hour prediction
    pred = engine.predict_congestion(hour_of_day=9, day_of_week=1, rain_intensity_mm=15.0)
    assert pred["congestion_index"] > 0.4
    assert "congestion_level" in pred

    # Test optimal departure time recommendation
    opt = engine.recommend_optimal_departure_time(target_departure_hour=9, day_of_week=1)
    assert "recommended_time" in opt
    assert len(opt["all_window_options"]) == 5

def test_lane_guidance_engine():
    engine = LaneGuidanceEngine()
    lanes = engine.generate_junction_lanes(total_lanes=4, maneuver_type="TURN_LEFT")
    assert lanes["total_lanes"] == 4
    assert 0 in lanes["recommended_lane_indices"]
    assert len(lanes["lanes"]) == 4

def test_ev_energy_routing_engine():
    engine = EVEnergyRoutingEngine()
    # Short trip (20 km)
    sim = engine.calculate_energy_consumption(distance_km=20.0, current_soc_percent=90.0)
    assert sim["requires_charging_stop"] is False
    assert sim["remaining_soc_percent"] > 80.0

    # Long trip (500 km)
    sim_long = engine.calculate_energy_consumption(distance_km=500.0, current_soc_percent=50.0)
    assert sim_long["requires_charging_stop"] is True

    stops = engine.plan_charging_stops(route_distance_km=500.0, current_soc_percent=50.0, chargers_along_route=[])
    assert stops["charging_stops_count"] >= 1

def test_monsoon_safety_engine():
    engine = MonsoonSafetyEngine()
    # Low rain
    safe = engine.evaluate_route_monsoon_safety(rainfall_mm_per_hr=2.0)
    assert safe["safety_level"] == "SAFE"

    # Heavy monsoon rain + underpasses
    hazard = engine.evaluate_route_monsoon_safety(rainfall_mm_per_hr=35.0, underpasses_count=2, recent_waterlogging_reports=2)
    assert hazard["safety_level"] == "HIGH_MONSOON_FLOOD_HAZARD"
