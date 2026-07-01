from fastapi import APIRouter, Depends, Body, status
from pydantic import BaseModel
from app.services.ai_voice_service import AIVoiceService

router = APIRouter()
service = AIVoiceService()

class VoiceQueryRequest(BaseModel):
    query: str

@router.post("/query", status_code=status.HTTP_200_OK)
async def process_voice_query(payload: VoiceQueryRequest = Body(...)):
    return await service.process_voice_command(payload.query)
