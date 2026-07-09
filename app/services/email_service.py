import logging
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
from fastapi import HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_from_email = settings.SMTP_FROM_EMAIL
        self.smtp_from_name = settings.SMTP_FROM_NAME

    async def send_otp_email(self, email: str, code: str, flow: str) -> Dict[str, Any]:
        """
        Sends verification code (OTP) to the specified email address.
        """
        # Bypass or mock send in dev mode / when SMTP is not configured / for test domain
        if email.endswith("@example.com") or not self.smtp_host:
            logger.info(f"[MOCK EMAIL OTP] Verification code for {email} ({flow}) is: {code}")
            return {"status": "pending", "mock": True, "email": email}

        # Create message container
        msg = MIMEMultipart()
        msg['From'] = f"{self.smtp_from_name} <{self.smtp_from_email}>"
        msg['To'] = email
        msg['Subject'] = f"B-Map - {flow.capitalize()} Verification Code"

        # Email body
        body = f"""Hello,

Your verification code for {flow} is: {code}

This code is valid for 5 minutes. If you did not request this code, please ignore this email.

Best regards,
The B-Map Team
"""
        msg.attach(MIMEText(body, 'plain'))

        # Send the email using SMTP
        try:
            # Run SMTP blocking call in executor
            await asyncio.to_thread(self._send_mail_sync, email, msg)
            logger.info(f"Email OTP sent successfully to {email}")
            return {"status": "sent", "email": email}
        except Exception as e:
            logger.error(f"Failed to send email to {email}: {e}")
            # Fallback to mock in development if SMTP fails
            if settings.ENV == "development":
                logger.warning(f"SMTP failed in development, falling back to mock OTP: {code}")
                return {"status": "pending", "mock": True, "email": email}
            raise HTTPException(
                status_code=500,
                detail=f"Failed to send verification email: {str(e)}"
            )

    def _send_mail_sync(self, email: str, msg: MIMEMultipart):
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            server.starttls()
            if self.smtp_username and self.smtp_password:
                server.login(self.smtp_username, self.smtp_password)
            server.sendmail(self.smtp_from_email, email, msg.as_string())
