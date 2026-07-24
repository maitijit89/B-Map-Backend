import httpx
import logging
from app.core.config import settings
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

class TwilioService:
    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.verify_service_sid = settings.TWILIO_VERIFY_SERVICE_SID
        self.base_url = f"https://verify.twilio.com/v2/Services/{self.verify_service_sid}"

    async def send_otp(self, phone_number: str) -> dict:
        """
        Sends verification code (OTP) to the specified phone number.
        Returns a dictionary with status information.
        """
        # Support mock phone numbers starting with +1555 or +91555 for automated testing and dev bypass
        if phone_number.startswith("+1555") or phone_number.startswith("+91555") or phone_number == "+1234567890":
            logger.info(f"[MOCK OTP] Bypassing Twilio Verify SMS send for phone number: {phone_number}")
            return {"status": "pending", "mock": True}

        url = f"{self.base_url}/Verifications"
        data = {
            "To": phone_number,
            "Channel": "sms"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    data=data,
                    auth=(self.account_sid, self.auth_token),
                    timeout=10.0
                )
                
                if response.status_code not in (200, 201):
                    logger.error(f"Twilio Send OTP error status={response.status_code} response={response.text}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to send OTP via Twilio: {response.json().get('message', 'Unknown error')}"
                    )
                
                return response.json()
            except httpx.RequestError as exc:
                logger.error(f"HTTP Request failed while calling Twilio Send OTP: {exc}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Communication with verification provider failed."
                )

    async def verify_otp(self, phone_number: str, code: str) -> bool:
        """
        Verifies the code sent to the specified phone number.
        Returns True if code is correct and approved.
        """
        # Support mock code '123456' or '000000' for mock/test phone numbers
        if (phone_number.startswith("+1555") or phone_number.startswith("+91555") or phone_number == "+1234567890") and code in ("123456", "000000"):
            logger.info(f"[MOCK OTP] Bypassing Twilio Verification for mock phone number {phone_number} with code {code}")
            return True

        url = f"{self.base_url}/VerificationCheck"
        data = {
            "To": phone_number,
            "Code": code
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    data=data,
                    auth=(self.account_sid, self.auth_token),
                    timeout=10.0
                )
                
                if response.status_code not in (200, 201):
                    logger.error(f"Twilio Verify OTP error status={response.status_code} response={response.text}")
                    return False
                
                res_data = response.json()
                return res_data.get("status") == "approved"
            except httpx.RequestError as exc:
                logger.error(f"HTTP Request failed while calling Twilio Verify OTP: {exc}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Communication with verification provider failed."
                )
