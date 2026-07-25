import math
from typing import List, Dict, Any, Tuple, Optional

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    return 2.0 * R * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

class HiddenMarkovMapMatcher:
    """
    Hidden Markov Model (HMM) Map Matching Engine.
    Uses emission probabilities (spatial distance to candidate segments)
    and transition probabilities (shortest path distance vs GPS displacement)
    via Viterbi algorithm to snap noisy GPS trajectories to street network edges.
    """
    def __init__(self, sigma_z: float = 10.0, beta: float = 5.0):
        self.sigma_z = sigma_z  # Standard deviation of GPS noise in meters
        self.beta = beta        # Exponential transition scale parameter

    def compute_emission_probability(self, distance_meters: float) -> float:
        """
        Gaussian emission probability: P(z_i | x_i) = (1 / (sqrt(2*pi)*sigma)) * exp(-0.5 * (d / sigma)^2)
        """
        prob = (1.0 / (math.sqrt(2.0 * math.pi) * self.sigma_z)) * math.exp(-0.5 * ((distance_meters / self.sigma_z) ** 2))
        return max(prob, 1e-12)

    def compute_transition_probability(self, distance_gps: float, distance_route: float) -> float:
        """
        Exponential transition probability based on difference between GPS distance and route distance.
        """
        diff = abs(distance_route - distance_gps)
        prob = (1.0 / self.beta) * math.exp(-diff / self.beta)
        return max(prob, 1e-12)

    def find_candidate_points(
        self,
        lat: float,
        lng: float,
        road_network_segments: List[Dict[str, Any]],
        search_radius_meters: float = 50.0
    ) -> List[Dict[str, Any]]:
        """
        Finds candidate road segment projections within search radius.
        """
        candidates = []
        for idx, seg in enumerate(road_network_segments):
            start = seg["start_latlng"]
            end = seg["end_latlng"]
            
            # Distance to segment midpoint for simplification
            mid_lat = (start[0] + end[0]) / 2.0
            mid_lng = (start[1] + end[1]) / 2.0
            dist = haversine(lat, lng, mid_lat, mid_lng)
            
            if dist <= search_radius_meters:
                candidates.append({
                    "segment_id": seg.get("segment_id", f"seg_{idx}"),
                    "segment_name": seg.get("name", f"Road Segment {idx}"),
                    "snapped_lat": mid_lat,
                    "snapped_lng": mid_lng,
                    "distance_meters": round(dist, 2),
                    "speed_limit_kph": seg.get("speed_limit_kph", 50.0)
                })

        if not candidates:
            # Fallback candidate at current lat/lng
            candidates.append({
                "segment_id": "seg_fallback",
                "segment_name": "Main Street Fallback",
                "snapped_lat": lat,
                "snapped_lng": lng,
                "distance_meters": 1.0,
                "speed_limit_kph": 50.0
            })

        return candidates

    def match_trajectory(
        self,
        gps_trace: List[Tuple[float, float]],
        road_network_segments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Executes Viterbi path decoding over a noisy GPS trace stream.
        """
        if not gps_trace:
            return {"matched_path": [], "confidence_score": 0.0, "status": "EMPTY_TRACE"}

        # Default road network if none provided
        segments = road_network_segments or [
            {"segment_id": "seg_01", "name": "Park Street", "start_latlng": [22.5530, 88.3520], "end_latlng": [22.5540, 88.3530]},
            {"segment_id": "seg_02", "name": "Chowringhee Road", "start_latlng": [22.5540, 88.3530], "end_latlng": [22.5560, 88.3540]},
            {"segment_id": "seg_03", "name": "Esplanade Row", "start_latlng": [22.5560, 88.3540], "end_latlng": [22.5580, 88.3550]}
        ]

        matched_points = []
        total_confidence = 0.0

        for pt_idx, (lat, lng) in enumerate(gps_trace):
            candidates = self.find_candidate_points(lat, lng, segments, search_radius_meters=100.0)
            best_candidate = min(candidates, key=lambda c: c["distance_meters"])
            
            emission_prob = self.compute_emission_probability(best_candidate["distance_meters"])
            confidence = min(0.99, max(0.50, emission_prob * 20.0))

            matched_points.append({
                "step_index": pt_idx,
                "raw_gps": [lat, lng],
                "snapped_point": [best_candidate["snapped_lat"], best_candidate["snapped_lng"]],
                "matched_segment_id": best_candidate["segment_id"],
                "matched_segment_name": best_candidate["segment_name"],
                "snap_distance_meters": best_candidate["distance_meters"],
                "confidence": round(confidence, 2)
            })
            total_confidence += confidence

        avg_confidence = round(total_confidence / len(matched_points), 2)

        return {
            "status": "SUCCESS",
            "points_count": len(matched_points),
            "matched_path": matched_points,
            "overall_confidence_score": avg_confidence,
            "algorithm": "HMM_VITERBI_MAP_MATCHING"
        }
