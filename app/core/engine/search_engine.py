import math
from typing import List, Dict, Any, Optional

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the great-circle distance between two points on the Earth in meters.
    """
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return R * c

def levenshtein_similarity(s1: str, s2: str) -> float:
    """
    Calculates normalized similarity (0.0 to 1.0) between two strings.
    """
    s1, s2 = s1.lower().strip(), s2.lower().strip()
    if not s1 or not s2:
        return 0.0
    if s1 == s2:
        return 1.0

    len1, len2 = len(s1), len(s2)
    dp = [[0] * (len2 + 1) for _ in range(len1 + 1)]

    for i in range(len1 + 1):
        dp[i][0] = i
    for j in range(len2 + 1):
        dp[0][j] = j

    for i in range(1, len1 + 1):
        for j in range(1, len2 + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,       # Deletion
                dp[i][j - 1] + 1,       # Insertion
                dp[i - 1][j - 1] + cost  # Substitution
            )

    distance = dp[len1][len2]
    max_len = max(len1, len2)
    return round(1.0 - (distance / max_len), 3)

class SpatialSearchEngine:
    """
    High-performance spatial search and ranking engine for places and addresses.
    Combines text fuzzy relevance, spatial proximity weighting, and place popularity.
    """
    def rank_places(
        self,
        query: str,
        places: List[Dict[str, Any]],
        user_lat: Optional[float] = None,
        user_lng: Optional[float] = None,
        max_results: int = 10
    ) -> List[Dict[str, Any]]:
        scored_places = []
        for place in places:
            name = place.get("name", "")
            address = place.get("address") or place.get("formatted_address", "")
            lat = place.get("lat") or place.get("geometry", {}).get("location", {}).get("lat")
            lng = place.get("lng") or place.get("geometry", {}).get("location", {}).get("lng")
            
            # Text similarity score (0.0 to 1.0)
            name_sim = levenshtein_similarity(query, name)
            addr_sim = levenshtein_similarity(query, address) * 0.5
            text_score = max(name_sim, addr_sim)

            # Spatial distance & proximity score
            dist_meters = 0.0
            proximity_score = 1.0
            if user_lat is not None and user_lng is not None and lat is not None and lng is not None:
                dist_meters = haversine_distance(user_lat, user_lng, lat, lng)
                # Exponential decay score for distance (decay half-life = 5km)
                proximity_score = math.exp(-dist_meters / 5000.0)

            # Popularity/Rating score
            rating = place.get("rating", 4.0)
            rating_score = rating / 5.0

            # Combined ranking score formula: 50% text similarity + 35% spatial proximity + 15% rating
            final_score = (text_score * 0.50) + (proximity_score * 0.35) + (rating_score * 0.15)

            item = dict(place)
            item["search_rank_score"] = round(final_score, 4)
            item["distance_meters"] = round(dist_meters, 1)
            scored_places.append(item)

        # Sort descending by search_rank_score
        scored_places.sort(key=lambda x: x["search_rank_score"], reverse=True)
        return scored_places[:max_results]
