from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional
from enum import Enum

class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class OTPFlow(str, Enum):
    SIGNUP = "signup"
    LOGIN = "login"

class SendOTPRequest(BaseModel):
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None
    flow: OTPFlow
    is_resend: bool = False

    @field_validator("phone_number", mode="before")
    @classmethod
    def clean_and_format_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if not isinstance(v, str):
            return v
        cleaned = "".join(v.split()).replace("-", "")
        if cleaned.isdigit() and len(cleaned) == 10:
            return f"+91{cleaned}"
        if cleaned.isdigit() and len(cleaned) == 12 and cleaned.startswith("91"):
            return f"+{cleaned}"
        if not cleaned.startswith("+") and cleaned.isdigit():
            return f"+{cleaned}"
        return cleaned

class VerifyOTPRequest(BaseModel):
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None
    code: str
    flow: Optional[OTPFlow] = None

    @field_validator("phone_number", mode="before")
    @classmethod
    def clean_and_format_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if not isinstance(v, str):
            return v
        cleaned = "".join(v.split()).replace("-", "")
        if cleaned.isdigit() and len(cleaned) == 10:
            return f"+91{cleaned}"
        if cleaned.isdigit() and len(cleaned) == 12 and cleaned.startswith("91"):
            return f"+{cleaned}"
        if not cleaned.startswith("+") and cleaned.isdigit():
            return f"+{cleaned}"
        return cleaned

class VerifyOTPResponse(BaseModel):
    registered: bool
    token: Optional[str] = None
    temp_token: Optional[str] = None
    user: Optional["UserResponse"] = None

class UserEmailRegisterRequest(BaseModel):
    temp_token: str
    display_name: str
    gender: Optional[str] = None
    dob: Optional[str] = None

class UserResponse(UserBase):
    id: UUID
    phone_number: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[str] = None
    profile_pic_url: Optional[str] = None
    is_email_verified: bool = False
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
