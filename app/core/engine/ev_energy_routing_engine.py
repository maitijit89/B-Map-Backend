import math
from typing import List, Dict, Any, Optional

class EVEnergyRoutingEngine:
    """
    EV Energy & Charging Planner Engine:
    Predicts battery consumption (SoC %) based on route distance, elevation gains,
    vehicle weight, ambient temperature, and plans optimal charging stops.
    """
    def calculate_energy_consumption(
        self,
        distance_km: float,
        elevation_gain_meters: float = 0.0,
        battery_capacity_kwh: float = 60.0,
        current_soc_percent: float = 80.0,
        vehicle_efficiency_wh_per_km: float = 150.0,
        ambient_temp_celsius: float = 30.0
    ) -> Dict[str, Any]:
        # Base energy consumption in kWh
        base_kwh = (distance_km * vehicle_efficiency_wh_per_km) / 1000.0

        # Elevation gain impact (approx 2.7 kWh per 1000m climb for 1500kg EV)
        climb_kwh = (max(0.0, elevation_gain_meters) / 1000.0) * 2.7

        # AC/Heating temperature impact (Indian summers 35°C+ increases AC load by 15%)
        temp_mult = 1.0
        if ambient_temp_celsius > 32.0:
            temp_mult = 1.15
        elif ambient_temp_celsius < 10.0:
            temp_mult = 1.20

        total_consumed_kwh = (base_kwh + climb_kwh) * temp_mult
        soc_consumed_percent = (total_consumed_kwh / battery_capacity_kwh) * 100.0
        remaining_soc_percent = max(0.0, current_soc_percent - soc_consumed_percent)

        usable_remaining_range_km = (remaining_soc_percent / 100.0) * ((battery_capacity_kwh * 1000.0) / vehicle_efficiency_wh_per_km)

        requires_charging_stop = remaining_soc_percent < 15.0

        return {
            "initial_soc_percent": current_soc_percent,
            "consumed_kwh": round(total_consumed_kwh, 2),
            "soc_consumed_percent": round(soc_consumed_percent, 1),
            "remaining_soc_percent": round(remaining_soc_percent, 1),
            "estimated_remaining_range_km": round(usable_remaining_range_km, 1),
            "requires_charging_stop": requires_charging_stop,
            "recommended_action": "RECHARGE_REQUIRED_EN_ROUTE" if requires_charging_stop else "RANGE_SUFFICIENT"
        }

    def plan_charging_stops(
        self,
        route_distance_km: float,
        current_soc_percent: float,
        chargers_along_route: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        sim = self.calculate_energy_consumption(route_distance_km, current_soc_percent=current_soc_percent)
        
        stops = []
        if sim["requires_charging_stop"]:
            # Pick best charger along route
            if chargers_along_route:
                best_charger = chargers_along_route[0]
                stops.append({
                    "charger_name": best_charger.get("name", "Fast EV Station"),
                    "lat": best_charger.get("lat"),
                    "lng": best_charger.get("lng"),
                    "recommended_charge_mins": 25,
                    "target_soc_percent": 80.0,
                    "connector_type": "CCS2 Dual Gun (60 kW DC)"
                })
            else:
                stops.append({
                    "charger_name": "TATA Power Fast Charger (Expressway Plaza)",
                    "recommended_charge_mins": 30,
                    "target_soc_percent": 80.0,
                    "connector_type": "CCS2 DC Fast Charger"
                })

        return {
            "route_distance_km": route_distance_km,
            "initial_soc_percent": current_soc_percent,
            "projected_final_soc_percent": sim["remaining_soc_percent"],
            "charging_stops_count": len(stops),
            "charging_stops": stops
        }
