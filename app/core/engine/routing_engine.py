import heapq
import math
from typing import List, Dict, Tuple, Any, Optional
from app.core.engine.search_engine import haversine_distance

class RoadNode:
    def __init__(self, node_id: str, lat: float, lng: float):
        self.node_id = node_id
        self.lat = lat
        self.lng = lng
        self.neighbors: List[Tuple[str, float, float, Dict[str, Any]]] = []  # (target_node_id, distance_m, speed_limit_kph, metadata)

class AStarRoutingEngine:
    """
    Core graph routing engine implementing A* Shortest Path algorithm for road networks.
    Supports multi-criteria optimization: 'shortest' (distance), 'fastest' (travel time), 'eco' (fuel efficient).
    """
    def __init__(self):
        self.nodes: Dict[str, RoadNode] = {}

    def add_node(self, node_id: str, lat: float, lng: float):
        if node_id not in self.nodes:
            self.nodes[node_id] = RoadNode(node_id, lat, lng)

    def add_edge(self, u_id: str, v_id: str, speed_limit_kph: float = 50.0, toll: bool = False, surface: str = "paved", is_one_way: bool = False):
        if u_id not in self.nodes or v_id not in self.nodes:
            return
        u_node = self.nodes[u_id]
        v_node = self.nodes[v_id]
        dist_m = haversine_distance(u_node.lat, u_node.lng, v_node.lat, v_node.lng)
        meta = {"toll": toll, "surface": surface}
        
        u_node.neighbors.append((v_id, dist_m, speed_limit_kph, meta))
        if not is_one_way:
            v_node.neighbors.append((u_id, dist_m, speed_limit_kph, meta))

    def _cost_function(self, dist_m: float, speed_kph: float, criteria: str, meta: Dict[str, Any]) -> float:
        if criteria == "shortest":
            return dist_m
        elif criteria == "eco":
            # Penalize toll roads & unpaved surfaces
            cost = dist_m
            if meta.get("toll"):
                cost *= 1.25
            if meta.get("surface") == "unpaved":
                cost *= 1.40
            return cost
        else:
            # Default "fastest": time in seconds
            speed_mps = max(speed_kph, 10.0) * (1000.0 / 3600.0)
            travel_time_sec = dist_m / speed_mps
            if meta.get("toll"):
                travel_time_sec *= 1.05
            return travel_time_sec

    def find_shortest_path(self, start_id: str, goal_id: str, criteria: str = "fastest") -> Optional[Dict[str, Any]]:
        """
        Executes A* algorithm from start_id to goal_id.
        """
        if start_id not in self.nodes or goal_id not in self.nodes:
            return None

        goal_node = self.nodes[goal_id]
        
        # Priority queue stores (f_score, current_node_id)
        open_set: List[Tuple[float, str]] = []
        heapq.heappush(open_set, (0.0, start_id))
        
        came_from: Dict[str, str] = {}
        g_score: Dict[str, float] = {node_id: float("inf") for node_id in self.nodes}
        g_score[start_id] = 0.0

        f_score: Dict[str, float] = {node_id: float("inf") for node_id in self.nodes}
        f_score[start_id] = haversine_distance(
            self.nodes[start_id].lat, self.nodes[start_id].lng,
            goal_node.lat, goal_node.lng
        )

        visited = set()

        while open_set:
            _, current_id = heapq.heappop(open_set)
            
            if current_id == goal_id:
                # Reconstruct path
                path_nodes = []
                curr = goal_id
                while curr in came_from:
                    path_nodes.append(curr)
                    curr = came_from[curr]
                path_nodes.append(start_id)
                path_nodes.reverse()

                # Calculate total stats & coordinates
                total_distance_m = 0.0
                total_duration_sec = 0.0
                path_points = []

                for i in range(len(path_nodes)):
                    nid = path_nodes[i]
                    n_obj = self.nodes[nid]
                    path_points.append({"lat": n_obj.lat, "lng": n_obj.lng, "node_id": nid})
                    if i > 0:
                        prev_id = path_nodes[i - 1]
                        prev_node = self.nodes[prev_id]
                        segment_dist = haversine_distance(prev_node.lat, prev_node.lng, n_obj.lat, n_obj.lng)
                        total_distance_m += segment_dist
                        total_duration_sec += segment_dist / (50.0 * 1000.0 / 3600.0)

                return {
                    "status": "OK",
                    "criteria": criteria,
                    "total_distance_meters": round(total_distance_m, 1),
                    "total_duration_seconds": int(round(total_duration_sec)),
                    "path_nodes_count": len(path_nodes),
                    "waypoints": path_points
                }

            if current_id in visited:
                continue
            visited.add(current_id)

            curr_node = self.nodes[current_id]
            for neighbor_id, dist_m, speed_kph, meta in curr_node.neighbors:
                edge_cost = self._cost_function(dist_m, speed_kph, criteria, meta)
                tentative_g_score = g_score[current_id] + edge_cost

                if tentative_g_score < g_score[neighbor_id]:
                    came_from[neighbor_id] = current_id
                    g_score[neighbor_id] = tentative_g_score
                    h_m = haversine_distance(
                        self.nodes[neighbor_id].lat, self.nodes[neighbor_id].lng,
                        goal_node.lat, goal_node.lng
                    )
                    f_score[neighbor_id] = tentative_g_score + h_m
                    heapq.heappush(open_set, (f_score[neighbor_id], neighbor_id))

        return None
