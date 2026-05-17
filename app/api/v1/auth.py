from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.user import GoogleLogin, AuthResponse
from app.services.auth_service import AuthService

router = APIRouter()

@router.post("/google", response_model=AuthResponse)
async def login_google(google_login: GoogleLogin, db: AsyncSession = Depends(get_db)):
    auth_service = AuthService(db)
    return await auth_service.login_google(google_login)
