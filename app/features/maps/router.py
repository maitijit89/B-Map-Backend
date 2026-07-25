from fastapi import APIRouter, Query, Body, Depends
from pydantic import BaseModel
from app.features.maps.service import MapsService
from app.core.database import get_db

from typing import Optional
from app.schemas.maps import (
    AROverlayRequest,
    AROverlayResponse,
    Panorama360View,
    IndoorPanoramaTourResponse,
    Cityscape3DResponse
)

router = APIRouter()
service = MapsService()

class TileSessionRequest(BaseModel):
    map_type: str = "roadmap"

class CreateDatasetRequest(BaseModel):
    display_name: str

@router.post("/tiles/session")
async def create_tile_session(payload: TileSessionRequest = Body(...)):
    return await service.create_tile_session(payload.map_type)

@router.get("/elevation")
async def get_elevation(locations: str = Query(..., description="Coordinates separated by pipe, e.g. 'lat1,lng1|lat2,lng2'")):
    return await service.get_elevation(locations)

@router.get("/aerial-view")
async def get_aerial_view(address: str = Query(..., description="Street address or location name")):
    return await service.get_aerial_view(address)

@router.get("/static")
def get_static_map(
    center: str = Query(..., description="Center of map, e.g. 'lat,lng' or address"),
    zoom: int = Query(14, description="Map zoom level"),
    size: str = Query("600x400", description="Image dimensions")
):
    return service.get_static_map_url(center, zoom, size)

@router.get("/streetview")
def get_street_view(
    location: str = Query(..., description="Location of panorama, e.g. 'lat,lng' or address"),
    size: str = Query("600x400", description="Image dimensions")
):
    return service.get_street_view_url(location, size)

@router.get("/datasets")
async def list_datasets():
    return await service.list_datasets()

@router.post("/datasets")
async def create_dataset(payload: CreateDatasetRequest = Body(...)):
    return await service.create_dataset(payload.display_name)

@router.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str):
    return await service.delete_dataset(dataset_id)

@router.get("/convert-coordinates")
async def convert_coordinates(
    lat: float = Query(...),
    lng: float = Query(...),
    from_sys: str = Query("WGS84", description="Original coordinate system (WGS84, GCJ02, BD09)"),
    to_sys: str = Query("BD09", description="Target coordinate system (WGS84, GCJ02, BD09)")
):
    return await service.convert_coordinates(lat, lng, from_sys, to_sys)

@router.get("/3d-metadata")
async def get_3d_metadata(
    city: str = Query(..., description="City name (e.g. Beijing, Shanghai, Guangzhou, Shenzhen)")
):
    return await service.get_3d_metadata(city)

@router.get("/indoor")
async def get_indoor_map(
    location_name: str = Query(..., description="Name of the indoor station/mall"),
    db = Depends(get_db)
):
    return await service.get_indoor_map(location_name, db)

@router.get("/panoramas")
async def get_streetview_panoramas(
    lat: float = Query(...),
    lng: float = Query(...),
    db = Depends(get_db)
):
    return await service.get_streetview_panoramas(lat, lng, db)

@router.get("/traffic")
async def get_realtime_traffic(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(5000, description="Search radius in meters"),
    db = Depends(get_db)
):
    return await service.get_realtime_traffic(lat, lng, radius, db)

@router.post("/ar-navigation", response_model=AROverlayResponse)
async def get_ar_navigation_overlay(payload: AROverlayRequest = Body(...)):
    """
    AR Real-Life Navigation: Superimposes 3D directional arrows and landmark anchors onto live camera feeds.
    """
    return await service.get_ar_navigation_overlay(
        current_lat=payload.current_lat,
        current_lng=payload.current_lng,
        heading=payload.heading,
        camera_fov_horizontal=payload.camera_fov_horizontal,
        destination=payload.destination
    )

@router.get("/panoramas/view", response_model=Panorama360View)
async def get_panorama_360_view(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    pano_id: Optional[str] = Query(None, description="Panorama ID"),
    heading: float = Query(0.0, description="Compass heading"),
    pitch: float = Query(0.0, description="Pitch angle")
):
    """
    Panorama (Street View): Retrieves 360-degree ground-level views and historical imagery timelines.
    """
    return await service.get_panorama_360_view(lat, lng, pano_id, heading, pitch)

@router.get("/panoramas/indoor-tour", response_model=IndoorPanoramaTourResponse)
async def get_indoor_panorama_tour(
    venue_name: str = Query(..., description="Name of the shopping mall, airport, or train station"),
    floor_level: int = Query(1, description="Floor level number")
):
    """
    Panorama (Street View): Retrieves detailed indoor 360-degree views of large buildings like shopping malls and airports.
    """
    return await service.get_indoor_panorama_tour(venue_name, floor_level)

@router.get("/3d-cityscape", response_model=Cityscape3DResponse)
async def get_3d_cityscape(
    city: str = Query("Kolkata", description="City name"),
    lat: Optional[float] = Query(22.5726, description="Center latitude"),
    lng: Optional[float] = Query(88.3639, description="Center longitude"),
    radius_meters: float = Query(1500.0, description="Bounding radius in meters"),
    detail_level: str = Query("LOD2", description="Level of detail (LOD1, LOD2, LOD3)")
):
    """
    3D Maps: Provides detailed three-dimensional building footprints, heights, roof geometries, and cityscapes.
    """
    return await service.get_3d_cityscape(city, lat, lng, radius_meters, detail_level)

