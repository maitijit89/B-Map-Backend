from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.session import get_db
from app.schemas.user import GoogleLogin, FirebaseLogin, AuthResponse, UserCreate, UserLogin
from app.services.auth_service import AuthService

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

