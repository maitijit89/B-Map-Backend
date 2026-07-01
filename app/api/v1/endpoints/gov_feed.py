from fastapi import APIRouter, Query, status
from app.services.gov_feed_service import GovFeedService

router = APIRouter()
service = GovFeedService()

@router.get("/gov-feeds", status_code=status.HTTP_200_OK)
async def get_government_feeds(
    lat: float = Query(...),
    lng: float = Query(...)
):
    return await service.get_government_feeds(lat, lng)
