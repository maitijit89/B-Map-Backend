from fastapi import APIRouter, Depends, Form, File, UploadFile, Body, status, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import os
import uuid
import shutil

from app.core.database import get_db
from app.shared.dependencies import get_current_user
from app.core.security import create_access_token
from app.shared.integrations.twilio_service import TwilioService
from app.shared.integrations.otp_service import OTPService

from app.features.auth.models import User
from app.features.auth.schemas import (
    AuthResponse,
    UserCreate,
    UserLogin,
    UserMeResponse,
    SendOTPRequest,
    VerifyOTPRequest,
    VerifyOTPResponse,
    UserEmailRegisterRequest,
    OTPFlow,
    UserResponse,
)
from app.features.auth.service import AuthService

router = APIRouter()

UPLOAD_DIR = "app/static/uploads"

@router.post("/register", response_model=AuthResponse)
async def register(user_in: UserCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    auth_service = AuthService(db)
    return await auth_service.register(user_in)

@router.post("/login", response_model=AuthResponse)
async def login(user_in: UserLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    auth_service = AuthService(db)
    return await auth_service.login(user_in)

@router.post("/otp/send")
async def send_otp(req: SendOTPRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    if (not req.phone_number and not req.email) or (req.phone_number and req.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exactly one of phone_number or email must be provided."
        )
    otp_service = OTPService(db)
    await otp_service.send_otp_for_flow(
        phone_number=req.phone_number,
        email=req.email,
        flow=req.flow,
        is_resend=req.is_resend
    )
    msg = f"{req.flow.capitalize()} OTP sent successfully." if not req.is_resend else "OTP resent successfully."
    return {"message": msg}

@router.post("/otp/verify", response_model=VerifyOTPResponse)
async def verify_otp(req: VerifyOTPRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    if (not req.phone_number and not req.email) or (req.phone_number and req.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exactly one of phone_number or email must be provided."
        )
    from datetime import datetime, timezone
    
    if req.phone_number:
        twilio_service = TwilioService()
        verified = await twilio_service.verify_otp(req.phone_number, req.code)
        identifier = req.phone_number
        query_key = "phone_number"
        user_type_label = "Phone number"
    else:
        now = datetime.now(timezone.utc)
        query = {
            "identifier": req.email,
            "code": req.code,
            "expires_at": {"$gt": now}
        }
        if req.flow:
            query["flow"] = req.flow
        verification = await db.otp_verifications.find_one(query)
        verified = (verification is not None)
        if verified:
            await db.otp_verifications.delete_one({"_id": verification["_id"]})
        identifier = req.email
        query_key = "email"
        user_type_label = "Email"

    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
        
    auth_service = AuthService(db)
    user_doc = await db.users.find_one({query_key: identifier})
    
    if req.flow:
        if req.flow == OTPFlow.SIGNUP and user_doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{user_type_label} already registered. Please login."
            )
        elif req.flow == OTPFlow.LOGIN and not user_doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{user_type_label} is not registered. Please sign up."
            )

    if user_doc:
        if req.email:
            await db.users.update_one({"_id": user_doc["_id"]}, {"$set": {"is_email_verified": True}})
            user_doc["is_email_verified"] = True
        user = User.from_dict(user_doc)
        token = create_access_token(user.id)
        return VerifyOTPResponse(
            registered=True,
            token=token,
            user=UserResponse.model_validate(user)
        )
    else:
        temp_token = auth_service.create_temp_verification_token(identifier)
        return VerifyOTPResponse(
            registered=False,
            temp_token=temp_token
        )

@router.post("/register-mobile", response_model=AuthResponse)
async def register_mobile(
    temp_token: str = Form(...),
    display_name: str = Form(...),
    gender: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    profile_pic: Optional[UploadFile] = File(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    profile_pic_url = None
    if profile_pic and profile_pic.filename:
        try:
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            ext = os.path.splitext(profile_pic.filename)[1]
            filename = f"{uuid.uuid4()}{ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)
            with open(filepath, "wb") as buffer:
                shutil.copyfileobj(profile_pic.file, buffer)
            profile_pic_url = f"/static/uploads/{filename}"
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to save profile picture: {e}")
            
    auth_service = AuthService(db)
    return await auth_service.register_mobile(
        temp_token=temp_token,
        display_name=display_name,
        gender=gender,
        dob=dob,
        profile_pic_url=profile_pic_url
    )

@router.post("/register-email", response_model=AuthResponse)
async def register_email(
    temp_token: str = Form(...),
    display_name: str = Form(...),
    gender: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    profile_pic: Optional[UploadFile] = File(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    profile_pic_url = None
    if profile_pic and profile_pic.filename:
        try:
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            ext = os.path.splitext(profile_pic.filename)[1]
            filename = f"{uuid.uuid4()}{ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)
            with open(filepath, "wb") as buffer:
                shutil.copyfileobj(profile_pic.file, buffer)
            profile_pic_url = f"/static/uploads/{filename}"
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to save profile picture: {e}")
            
    auth_service = AuthService(db)
    return await auth_service.register_email(
        temp_token=temp_token,
        display_name=display_name,
        gender=gender,
        dob=dob,
        profile_pic_url=profile_pic_url
    )

@router.post("/register-email-json", response_model=AuthResponse)
async def register_email_json(
    payload: UserEmailRegisterRequest = Body(...),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    auth_service = AuthService(db)
    return await auth_service.register_email(
        temp_token=payload.temp_token,
        display_name=payload.display_name,
        gender=payload.gender,
        dob=payload.dob
    )

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully."}

@router.delete("/delete-account")
async def delete_account(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    auth_service = AuthService(db)
    success = await auth_service.delete_account(current_user)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account."
        )
    return {"message": "Account permanently deleted."}

@router.get("/splash-ads")
async def get_splash_ads_config():
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
