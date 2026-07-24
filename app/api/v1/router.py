from fastapi import APIRouter
from app.features.auth.router import router as auth_router
from app.features.incidents.router import router as incidents_router
from app.features.places.router import router as places_router
from app.features.navigation.router import router as navigation_router
from app.features.pins.router import router as pins_router
from app.features.reviews.router import router as reviews_router
from app.features.user_lists.router import router as lists_router
from app.features.timeline.router import router as timeline_router
from app.features.offline.router import router as offline_router
from app.features.maps.router import router as maps_router
from app.features.environment.router import router as environment_router
from app.features.voice.router import router as voice_router
from app.features.lifestyle.router import router as lifestyle_router
from app.features.car_sync.router import router as car_sync_router
from app.features.accessibility.router import router as accessibility_router
from app.features.cabs.router import router as cabs_router
from app.features.transit.router import router as transit_router
from app.features.shortcuts.router import router as shortcuts_router
from app.features.safety.router import router as safety_router
from app.features.carpool.router import router as carpool_router
from app.features.enforcement.router import router as enforcement_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(incidents_router, prefix="/incidents", tags=["Incidents"])
api_router.include_router(places_router, prefix="/places", tags=["Places"])
api_router.include_router(navigation_router, prefix="/navigation", tags=["Navigation"])
api_router.include_router(pins_router, prefix="/pins", tags=["User Pins"])
api_router.include_router(reviews_router, prefix="/reviews", tags=["Reviews & Ratings"])
api_router.include_router(lists_router, prefix="/lists", tags=["Saved Lists"])
api_router.include_router(timeline_router, prefix="/timeline", tags=["Timeline & History"])
api_router.include_router(offline_router, prefix="/offline", tags=["Offline Pre-fetching"])
api_router.include_router(maps_router, prefix="/maps", tags=["Maps"])
api_router.include_router(environment_router, prefix="/environment", tags=["Environment"])
api_router.include_router(voice_router, prefix="/voice", tags=["Voice Assistant"])
api_router.include_router(lifestyle_router, prefix="/lifestyle", tags=["Lifestyle & On-Demand"])
api_router.include_router(car_sync_router, prefix="/car-sync", tags=["Car & Device Sync"])
api_router.include_router(accessibility_router, prefix="/accessibility", tags=["Accessibility"])
api_router.include_router(cabs_router, prefix="/cabs", tags=["Cab Aggregator"])
api_router.include_router(transit_router, prefix="/transit", tags=["Live Transit Tracker"])
api_router.include_router(shortcuts_router, prefix="/users/shortcuts", tags=["Commute Shortcuts"])
api_router.include_router(safety_router, prefix="/safety", tags=["Safety & SOS"])
api_router.include_router(carpool_router, prefix="/carpool", tags=["Carpooling"])
api_router.include_router(enforcement_router, prefix="/enforcement", tags=["Traffic Enforcement"])
