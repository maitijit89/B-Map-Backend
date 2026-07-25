from pydantic import Field
from typing import List, Dict, Any, Optional
from app.schemas.base import SecureBaseModel

# --- AR Real-Life Navigation Schemas ---
class AROverlayRequest(SecureBaseModel):
    current_lat: float = Field(..., ge=-90.0, le=90.0, description="Current user latitude")
    current_lng: float = Field(..., ge=-180.0, le=180.0, description="Current user longitude")
    heading: float = Field(..., ge=0.0, le=360.0, description="Compass heading in degrees (0-360)")
    camera_fov_horizontal: float = Field(68.0, ge=10.0, le=160.0, description="Camera horizontal field-of-view in degrees")
    destination: str = Field(..., min_length=1, max_length=256, description="Target destination coordinate or name")

class ARMarker3D(SecureBaseModel):
    id: str = Field(..., max_length=100)
    marker_type: str = Field(..., max_length=50)
    screen_coordinate_x: float = Field(..., ge=0.0, le=1.0)
    screen_coordinate_y: float = Field(..., ge=0.0, le=1.0)
    depth_z_meters: float = Field(..., ge=0.0)
    yaw_rotation_deg: float = Field(..., ge=-360.0, le=360.0)
    pitch_rotation_deg: float = Field(..., ge=-90.0, le=90.0)
    title: str = Field(..., max_length=150)
    instruction: str = Field(..., max_length=500)
    icon_color_hex: str = Field("#00E5FF", max_length=10)

class AROverlayResponse(SecureBaseModel):
    ar_supported: bool = True
    active_mode: str = Field("OUTDOOR_WALKING_AR", max_length=50)
    camera_calibration: Dict[str, float]
    markers: List[ARMarker3D]
    next_step_instruction: str = Field(..., max_length=500)
    distance_to_destination_meters: float = Field(..., ge=0.0)


# --- Panorama (Street View & Indoor Tours) Schemas ---
class PanoramaHotspot(SecureBaseModel):
    hotspot_id: str = Field(..., max_length=100)
    target_pano_id: str = Field(..., max_length=100)
    title: str = Field(..., max_length=150)
    heading: float = Field(..., ge=0.0, le=360.0)
    pitch: float = Field(..., ge=-90.0, le=90.0)
    distance_meters: float = Field(..., ge=0.0)

class Panorama360View(SecureBaseModel):
    pano_id: str = Field(..., max_length=100)
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    heading: float = Field(..., ge=0.0, le=360.0)
    pitch: float = Field(..., ge=-90.0, le=90.0)
    fov: float = Field(90.0, ge=10.0, le=160.0)
    tile_url_template: str = Field(..., max_length=500)
    capture_date: str = Field(..., max_length=100)
    location_name: str = Field(..., max_length=256)
    historical_captures: List[Dict[str, Any]] = []
    connected_hotspots: List[PanoramaHotspot] = []

class IndoorPanoramaTourResponse(SecureBaseModel):
    venue_name: str = Field(..., max_length=150)
    venue_type: str = Field(..., max_length=50)
    total_floors: int = Field(..., ge=1, le=150)
    current_floor: int = Field(..., ge=-10, le=150)
    floor_name: str = Field(..., max_length=100)
    panoramas: List[Panorama360View]


# --- 3D Maps Schemas ---
class BuildingFootprint3D(SecureBaseModel):
    building_id: str = Field(..., max_length=100)
    building_name: Optional[str] = Field(None, max_length=150)
    height_meters: float = Field(..., ge=0.0, le=1200.0)
    floors_count: int = Field(..., ge=1, le=300)
    roof_type: str = Field(..., max_length=50)
    category: str = Field(..., max_length=50)
    color_hex: str = Field(..., max_length=10)
    coordinates_polygon: List[List[float]]

class Cityscape3DResponse(SecureBaseModel):
    city_name: str = Field(..., max_length=100)
    perspective: str = Field("KolkataCity_3D_Isometric", max_length=100)
    center_lat: float = Field(..., ge=-90.0, le=90.0)
    center_lng: float = Field(..., ge=-180.0, le=180.0)
    bounding_radius_meters: float = Field(..., ge=0.0)
    buildings_count: int = Field(..., ge=0)
    buildings: List[BuildingFootprint3D]
    camera_preset: Dict[str, float]
