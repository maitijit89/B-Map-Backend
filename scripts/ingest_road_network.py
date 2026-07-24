import json
import httpx
import asyncio
import logging
from typing import Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Sample script to fetch and ingest OSM road network data for B-Map's Custom Routing Engine

async def fetch_osm_data(bbox: str) -> Dict[str, Any]:
    """
    Fetch road network data from OpenStreetMap Overpass API for a given bounding box.
    bbox format: "min_lat,min_lon,max_lat,max_lon"
    e.g., "28.50,77.10,28.70,77.30" (Delhi NCR roughly)
    """
    logger.info(f"Fetching OSM road network data for bbox: {bbox}")
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    # Overpass QL to get all highways (roads)
    query = f"""
    [out:json];
    (
      way["highway"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(overpass_url, data={'data': query})
        response.raise_for_status()
        return response.json()

def process_and_ingest(osm_data: Dict[str, Any]):
    """
    Parse the OSM JSON and extract Nodes (intersections/points) and Edges (road segments).
    This data can then be saved to MongoDB or directly loaded into AStarRoutingEngine.
    """
    nodes = {}
    edges = []
    
    # 1. Parse Nodes
    for element in osm_data.get('elements', []):
        if element['type'] == 'node':
            nodes[element['id']] = {
                "lat": element['lat'],
                "lon": element['lon']
            }
            
    # 2. Parse Ways (Edges)
    for element in osm_data.get('elements', []):
        if element['type'] == 'way':
            highway_type = element.get('tags', {}).get('highway', 'unknown')
            node_refs = element.get('nodes', [])
            
            # Create edges between consecutive nodes
            for i in range(len(node_refs) - 1):
                start_node = node_refs[i]
                end_node = node_refs[i+1]
                
                if start_node in nodes and end_node in nodes:
                    edges.append({
                        "start_id": start_node,
                        "end_id": end_node,
                        "highway_type": highway_type,
                        "start_coord": nodes[start_node],
                        "end_coord": nodes[end_node]
                    })
                    
    logger.info(f"Processed {len(nodes)} nodes and {len(edges)} road segments.")
    logger.info("TODO: Insert these edges into the AStarRoutingEngine graph or MongoDB collection.")
    
    # Example snippet of how you'd load this into your engine:
    # from app.core.engine.routing_engine import AStarRoutingEngine
    # engine = AStarRoutingEngine()
    # for edge in edges:
    #     engine.add_edge(str(edge['start_id']), str(edge['end_id']), weight=...)

async def main():
    # Example bounding box for Central New Delhi
    bbox = "28.6000,77.2000,28.6300,77.2300"
    try:
        osm_data = await fetch_osm_data(bbox)
        process_and_ingest(osm_data)
        logger.info("Ingestion complete.")
    except Exception as e:
        logger.error(f"Failed to ingest road network: {e}")

if __name__ == "__main__":
    asyncio.run(main())
