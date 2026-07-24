import math
import datetime
from typing import Dict, Any, List

class PredictiveTrafficEngine:
    """
    AI Predictive Traffic Engine:
    Forecasts future traffic congestion, average speeds, and travel delays
    based on historical profiles, time of day, monsoon factors, and event density.
    """
    @staticmethod
    def predict_congestion(
        hour_of_day: int,
        day_of_week: int,  # 0=Monday, 6=Sunday
        rain_intensity_mm: float = 0.0,
        event_density: float = 0.0
    ) -> Dict[str, Any]:
        # Base rush hour curve (Peak morning 8-10 AM, Peak evening 5-8 PM)
        is_weekend = day_of_week in [5, 6]
        
        if is_weekend:
            # Weekend peak around 1 PM - 9 PM
            base_congestion = 0.20 + 0.40 * math.exp(-((hour_of_day - 16) ** 2) / 18.0)
        else:
            # Weekday twin peaks
            morning_peak = math.exp(-((hour_of_day - 9) ** 2) / 4.0)
            evening_peak = math.exp(-((hour_of_day - 18) ** 2) / 6.0)
            base_congestion = 0.15 + 0.55 * max(morning_peak, evening_peak)

        # Monsoon rain impact factor (Rain heavy > 10mm/hr increases congestion by up to 0.35)
        rain_factor = min(0.35, rain_intensity_mm * 0.025)

        # Event/Protest density factor
        event_factor = min(0.25, event_density * 0.10)

        total_congestion = min(1.0, max(0.05, base_congestion + rain_factor + event_factor))

        if total_congestion < 0.30:
            level = "LOW"
            avg_speed_kph = 55.0
        elif total_congestion < 0.60:
            level = "MODERATE"
            avg_speed_kph = 32.0
        elif total_congestion < 0.85:
            level = "HEAVY"
            avg_speed_kph = 18.0
        else:
            level = "SEVERE_GRIDLOCK"
            avg_speed_kph = 8.0

        return {
            "predicted_hour": hour_of_day,
            "is_weekend": is_weekend,
            "congestion_index": round(total_congestion, 2),
            "congestion_level": level,
            "predicted_speed_kph": round(avg_speed_kph, 1),
            "rain_impact_applied": rain_intensity_mm > 0,
            "delay_multiplier": round(1.0 + (total_congestion * 1.2), 2)
        }

    def recommend_optimal_departure_time(
        self,
        target_departure_hour: int,
        day_of_week: int = 0
    ) -> Dict[str, Any]:
        """
        Calculates travel duration variance across a +/- 2 hour window to recommend optimal departure time.
        """
        options = []
        for offset in [-60, -30, 0, 30, 60]:
            eval_hour = (target_departure_hour + (offset / 60.0)) % 24
            pred = self.predict_congestion(int(eval_hour), day_of_week)
            options.append({
                "departure_offset_minutes": offset,
                "evaluated_time": f"{int(eval_hour):02d}:{(int((eval_hour % 1) * 60)):02d}",
                "congestion_index": pred["congestion_index"],
                "predicted_speed_kph": pred["predicted_speed_kph"],
                "delay_multiplier": pred["delay_multiplier"]
            })

        options.sort(key=lambda x: x["congestion_index"])
        best_option = options[0]

        return {
            "recommended_offset_minutes": best_option["departure_offset_minutes"],
            "recommended_time": best_option["evaluated_time"],
            "lowest_congestion_index": best_option["congestion_index"],
            "time_savings_potential": f"{int((1.0 - (best_option['congestion_index']/0.8)) * 100)}%" if best_option["congestion_index"] < 0.8 else "0%",
            "all_window_options": options
        }
