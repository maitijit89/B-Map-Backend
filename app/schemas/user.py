from pydantic import BaseModel, EmailStr, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleLogin(BaseModel):
    id_token: str

class FirebaseLogin(BaseModel):
    id_token: str

class UserResponse(UserBase):
    id: UUID
    phone_number: Optional[str] = None
    firebase_uid: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class AuthResponse(BaseModel):
    token: str
    user: UserResponse

class GamificationProgress(BaseModel):
    level: int
    xp: int
    next_level_xp: int
    xp_progress_pct: float
    contribution_count: int
    badges: list[str]

class UserMeResponse(BaseModel):
    user: UserResponse
    gamification: GamificationProgress
