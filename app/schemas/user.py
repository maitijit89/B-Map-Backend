"""Re-export user schemas for backwards compatibility."""
from app.features.auth.schemas import (
    UserBase,
    UserCreate,
    UserLogin,
    OTPFlow,
    SendOTPRequest,
    VerifyOTPRequest,
    VerifyOTPResponse,
    UserEmailRegisterRequest,
    UserResponse,
    Token,
    AuthResponse,
    GamificationProgress,
    UserMeResponse,
)
