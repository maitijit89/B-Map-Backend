from fastapi import APIRouter, Query, Body, status
from pydantic import BaseModel
from app.features.cabs.service import CabService

router = APIRouter()
service = CabService()

class BookCabRequest(BaseModel):
    quote_id: str
    provider: str
    service_type: str

@router.get("/quote", status_code=status.HTTP_200_OK)
async def get_quotes(
    origin: str = Query(...),
    destination: str = Query(...)
):
    return await service.get_cabs_quotes(origin, destination)

@router.get("/indian-compare", status_code=status.HTTP_200_OK)
async def get_indian_cabs_comparison(
    origin: str = Query(...),
    destination: str = Query(...)
):
    """
    Returns live fare & ETA comparison across Auto-Rickshaws (Namma Yatri, Metered Auto, Shared Auto) and Cabs/Bikes (Uber, Ola, Rapido).
    """
    return await service.get_indian_auto_and_cab_comparison(origin, destination)

@router.post("/book", status_code=status.HTTP_201_CREATED)
async def book_cab(payload: BookCabRequest = Body(...)):
    return await service.book_cab(
        quote_id=payload.quote_id,
        provider=payload.provider,
        service_type=payload.service_type
    )
