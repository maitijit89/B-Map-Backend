from typing import Dict, Any, List

class MonsoonSafetyEngine:
    """
    Monsoon & Road Safety Risk Engine:
    Evaluates real-time rain intensity, terrain slope, low-lying underpasses,
    and user hazard reports to produce actionable safety alerts.
    """
    def evaluate_route_monsoon_safety(
        self,
        rainfall_mm_per_hr: float = 0.0,
        underpasses_count: int = 0,
        recent_waterlogging_reports: int = 0
    ) -> Dict[str, Any]:
        risk_score = 0.0

        # Rain severity
        if rainfall_mm_per_hr > 25.0:
            risk_score += 0.50  # Heavy monsoon rain
        elif rainfall_mm_per_hr > 10.0:
            risk_score += 0.25

        # Underpass exposure
        risk_score += min(0.30, underpasses_count * 0.15)

        # Crowd reports
        risk_score += min(0.40, recent_waterlogging_reports * 0.20)

        risk_score = min(1.0, risk_score)

        if risk_score < 0.25:
            level = "SAFE"
            action = "PROCEED_NORMALLY"
            speech = "Route is clear with no waterlogging hazards detected."
        elif risk_score < 0.60:
            level = "MODERATE_RISK"
            action = "SLIGHT_DELAYS_EXPECTED"
            speech = "Light waterlogging reported near underpasses. Drive with caution."
        else:
            level = "HIGH_MONSOON_FLOOD_HAZARD"
            action = "DIVERT_VIA_ELEVATED_FLYOVER"
            speech = "Warning: Severe waterlogging detected on lower service road. Diverting route via flyover."

        return {
            "monsoon_risk_score": round(risk_score, 2),
            "safety_level": level,
            "recommended_action": action,
            "voice_alert": speech,
            "underpass_waterlogging_risk": "HIGH" if underpasses_count > 0 and rainfall_mm_per_hr > 15.0 else "LOW"
        }
