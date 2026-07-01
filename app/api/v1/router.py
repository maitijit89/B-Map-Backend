from fastapi import APIRouter
from app.api.v1.endpoints import (
    accessibility,
    auth,
    cabs,
    car_sync,
    environment,
    gov_feed,
    incidents,
    lifestyle,
    lists,
    maps,
    navigation,
    offline,
    pins,
    places,
    reviews,
    shortcuts,
    timeline,
    transit,
    voice,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(incidents.router, prefix="/incidents", tags=["Incidents"])
api_router.include_router(places.router, prefix="/places", tags=["Places"])
api_router.include_router(navigation.router, prefix="/navigation", tags=["Navigation"])
api_router.include_router(pins.router, prefix="/pins", tags=["User Pins"])
api_router.include_router(reviews.router, prefix="/reviews", tags=["Reviews & Ratings"])
api_router.include_router(lists.router, prefix="/lists", tags=["Saved Lists"])
api_router.include_router(timeline.router, prefix="/timeline", tags=["Timeline & History"])
api_router.include_router(offline.router, prefix="/offline", tags=["Offline Pre-fetching"])
api_router.include_router(maps.router, prefix="/maps", tags=["Maps"])
api_router.include_router(environment.router, prefix="/environment", tags=["Environment"])
api_router.include_router(voice.router, prefix="/voice", tags=["Voice Assistant"])
api_router.include_router(lifestyle.router, prefix="/lifestyle", tags=["Lifestyle & On-Demand"])
api_router.include_router(car_sync.router, prefix="/car-sync", tags=["Car & Device Sync"])
api_router.include_router(gov_feed.router, prefix="/environment", tags=["Government Feeds"])
api_router.include_router(accessibility.router, prefix="/accessibility", tags=["Accessibility"])
api_router.include_router(cabs.router, prefix="/cabs", tags=["Cab Aggregator"])
api_router.include_router(transit.router, prefix="/transit", tags=["Live Transit Tracker"])
api_router.include_router(shortcuts.router, prefix="/users/shortcuts", tags=["Commute Shortcuts"])
