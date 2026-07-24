from typing import List, Dict, Any

class LaneGuidanceEngine:
    """
    Lane-Level Guidance Engine:
    Calculates lane positioning for multi-lane Indian highways, flyover splits, and junction interchanges.
    """
    def generate_junction_lanes(
        self,
        total_lanes: int = 4,
        maneuver_type: str = "TURN_LEFT"
    ) -> Dict[str, Any]:
        lanes = []
        for i in range(total_lanes):
            # 0-indexed from left to right
            lane_type = "THRU"
            is_active = False

            if maneuver_type in ["TURN_LEFT", "SLIGHT_LEFT"]:
                if i == 0:
                    lane_type = "LEFT_TURN_ONLY"
                    is_active = True
                elif i == 1:
                    lane_type = "LEFT_OR_THRU"
                    is_active = True
                else:
                    lane_type = "THRU"
            elif maneuver_type in ["TURN_RIGHT", "SLIGHT_RIGHT", "MAKE_UTURN"]:
                if i == total_lanes - 1:
                    lane_type = "RIGHT_TURN_ONLY"
                    is_active = True
                elif i == total_lanes - 2:
                    lane_type = "RIGHT_OR_THRU"
                    is_active = True
                else:
                    lane_type = "THRU"
            else:
                if 1 <= i <= total_lanes - 2:
                    is_active = True
                    lane_type = "THRU"

            lanes.append({
                "lane_index": i,
                "lane_position": "LEFT_MOST" if i == 0 else ("RIGHT_MOST" if i == total_lanes - 1 else f"LANE_{i+1}"),
                "lane_type": lane_type,
                "is_recommended": is_active
            })

        recommended_lane_indices = [l["lane_index"] for l in lanes if l["is_recommended"]]

        return {
            "total_lanes": total_lanes,
            "maneuver_type": maneuver_type,
            "recommended_lane_indices": recommended_lane_indices,
            "hud_guidance_text": f"Move to {'Left' if 'LEFT' in maneuver_type else ('Right' if 'RIGHT' in maneuver_type else 'Center')} Lanes",
            "lanes": lanes
        }
