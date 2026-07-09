from fastapi import APIRouter, Query, Body, Depends
from pydantic import BaseModel
from app.services.maps_service import MapsService
from app.db.session import get_db

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
