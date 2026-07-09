import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.user import OTPFlow
from app.services.twilio_service import TwilioService

logger = logging.getLogger(__name__)

def make_tz_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

class OTPService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.twilio_service = TwilioService()
        self.cooldown_seconds = 60  # Cooldown between OTP sends/resends
        self.max_attempts = 5      # Max attempts in the sliding window
        self.window_minutes = 60   # Sliding window size in minutes
        self.block_minutes = 15    # Block duration on rate limit breach

    async def get_attempt_record(self, identifier: str, flow: OTPFlow) -> Optional[dict]:
        return await self.db.otp_attempts.find_one({"identifier": identifier, "flow": flow})

    async def check_rate_limit(self, identifier: str, flow: OTPFlow) -> None:
        """
        Enforces a cooldown of 60 seconds between requests, and blocks
        abuse if there are more than 5 attempts in a 60-minute window.
        """
        now = datetime.now(timezone.utc)
        record = await self.get_attempt_record(identifier, flow)
        
        if not record:
            return

        # Check if the user is currently blocked
        blocked_until = make_tz_aware(record.get("blocked_until"))
        if blocked_until:
            if now < blocked_until:
                wait_min = int((blocked_until - now).total_seconds() / 60) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many OTP requests. Phone number is temporarily blocked. Try again in {wait_min} minute(s)."
                )
            else:
                # Block expired, reset block
                await self.db.otp_attempts.update_one(
                    {"identifier": identifier, "flow": flow},
                    {"$set": {"blocked_until": None, "send_count": 0, "first_sent_at": now}}
                )
                return

        # Check 60-second cooldown
        last_sent_at = make_tz_aware(record.get("last_sent_at"))
        if last_sent_at:
            elapsed = (now - last_sent_at).total_seconds()
            if elapsed < self.cooldown_seconds:
                retry_after = int(self.cooldown_seconds - elapsed)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {retry_after} seconds before requesting another OTP."
                )

        # Check sliding window count
        first_sent_at = make_tz_aware(record.get("first_sent_at"))
        if first_sent_at:
            window_elapsed = (now - first_sent_at).total_seconds()
            
            if window_elapsed < self.window_minutes * 60:
                if record.get("send_count", 0) >= self.max_attempts:
                    blocked_until = now + timedelta(minutes=self.block_minutes)
                    await self.db.otp_attempts.update_one(
                        {"identifier": identifier, "flow": flow},
                        {"$set": {"blocked_until": blocked_until}}
                    )
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Too many OTP requests. Phone number is temporarily blocked for {self.block_minutes} minutes."
                    )
            else:
                # Window expired, reset window tracker
                await self.db.otp_attempts.update_one(
                    {"identifier": identifier, "flow": flow},
                    {"$set": {"first_sent_at": now, "send_count": 0}}
                )

    async def record_attempt(self, identifier: str, flow: OTPFlow) -> None:
        now = datetime.now(timezone.utc)
        record = await self.get_attempt_record(identifier, flow)
        
        if not record:
            await self.db.otp_attempts.insert_one({
                "identifier": identifier,
                "flow": flow,
                "last_sent_at": now,
                "first_sent_at": now,
                "send_count": 1,
                "blocked_until": None
            })
        else:
            first_sent_at = make_tz_aware(record.get("first_sent_at")) or now
            window_elapsed = (now - first_sent_at).total_seconds()
            
            if window_elapsed >= self.window_minutes * 60:
                # Reset window
                first_sent_at = now
                send_count = 1
            else:
                send_count = record.get("send_count", 0) + 1

            await self.db.otp_attempts.update_one(
                {"identifier": identifier, "flow": flow},
                {
                    "$set": {
                        "last_sent_at": now,
                        "first_sent_at": first_sent_at,
                        "send_count": send_count,
                        "blocked_until": None
                    }
                }
            )

    async def send_otp_for_flow(
        self,
        phone_number: Optional[str] = None,
        email: Optional[str] = None,
        flow: OTPFlow = OTPFlow.SIGNUP,
        is_resend: bool = False
    ) -> dict:
        identifier = phone_number or email
        if not identifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either phone number or email must be provided."
            )
            
        # Check user existence depending on flow
        if phone_number:
            user_doc = await self.db.users.find_one({"phone_number": phone_number})
            user_type = "Phone number"
        else:
            user_doc = await self.db.users.find_one({"email": email})
            user_type = "Email"
        
        if flow == OTPFlow.SIGNUP:
            if user_doc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{user_type} already registered. Please login."
                )
        elif flow == OTPFlow.LOGIN:
            if not user_doc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{user_type} is not registered. Please sign up."
                )
        
        # Enforce rate limit / cooldown
        await self.check_rate_limit(identifier, flow)
        
        if phone_number:
            # Send OTP via Twilio
            res = await self.twilio_service.send_otp(phone_number)
        else:
            # Generate a 6-digit OTP
            import secrets
            otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
            # Support mock code in development or for specific test emails
            if email == "test@example.com" or email.startswith("mock"):
                otp_code = "123456"
                
            # Store in DB: otp_verifications
            now = datetime.now(timezone.utc)
            expires_at = now + timedelta(minutes=5)
            await self.db.otp_verifications.update_one(
                {"identifier": email, "flow": flow},
                {
                    "$set": {
                        "code": otp_code,
                        "created_at": now,
                        "expires_at": expires_at,
                        "verified": False
                    }
                },
                upsert=True
            )
            
            # Send OTP via Email
            from app.services.email_service import EmailService
            email_service = EmailService()
            res = await email_service.send_otp_email(email, otp_code, flow)
            
        # Record attempt
        await self.record_attempt(identifier, flow)
        
        return res
