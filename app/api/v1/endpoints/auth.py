from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.session import get_db
from app.schemas.user import GoogleLogin, FirebaseLogin, AuthResponse, UserCreate, UserLogin, UserMeResponse
from app.services.auth_service import AuthService
from app.api.v1.deps import get_current_user
from app.db.models import User

router = APIRouter()

@router.post("/register", response_model=AuthResponse)
async def register(user_in: UserCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    auth_service = AuthService(db)
    return await auth_service.register(user_in)

@router.post("/login", response_model=AuthResponse)
async def login(user_in: UserLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    auth_service = AuthService(db)
    return await auth_service.login(user_in)

@router.post("/google", response_model=AuthResponse)
async def login_google(google_login: GoogleLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    auth_service = AuthService(db)
    return await auth_service.login_google(google_login)

@router.post("/firebase", response_model=AuthResponse)
async def login_firebase(firebase_login: FirebaseLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    auth_service = AuthService(db)
    return await auth_service.login_firebase(firebase_login)

@router.get("/splash-ads")
async def get_splash_ads_config():
    # Splash-screen ads removed as of June 2026
    return {
        "show_ads": False,
        "policy_effective_date": "2026-06-01",
        "message": "Splash-screen ads have been permanently removed."
    }

@router.get("/me", response_model=UserMeResponse)
async def get_me(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    auth_service = AuthService(db)
    return await auth_service.get_user_profile(current_user)

