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
        Sends verification code (OTP) to the specified email address using HTML + plain text format.
        """
        # Bypass or mock send for test domains or when SMTP host is missing
        if email.endswith("@example.com") or not self.smtp_host:
            logger.info(f"[MOCK EMAIL OTP] Verification code for {email} ({flow}) is: {code}")
            return {"status": "pending", "mock": True, "email": email}

        flow_title = "Sign Up" if flow == "signup" else "Sign In"

        msg = MIMEMultipart('alternative')
        msg['From'] = f"{self.smtp_from_name} <{self.smtp_from_email}>"
        msg['To'] = email
        msg['Subject'] = f"B-Map Verification Code: {code}"

        text_body = f"""Hello,

Your verification code for B-Map {flow_title} is: {code}

This code is valid for 5 minutes. Do not share this code with anyone.

Best regards,
The B-Map Team
"""

        html_body = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; }}
        .container {{ max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e1e4e8; }}
        .header {{ background: linear-gradient(135deg, #1E88E5, #1565C0); padding: 28px; text-align: center; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 1px; }}
        .header p {{ margin: 4px 0 0 0; opacity: 0.9; font-size: 13px; }}
        .content {{ padding: 32px 28px; text-align: center; color: #24292e; }}
        .greeting {{ font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #1565C0; }}
        .message {{ font-size: 14px; color: #586069; line-height: 1.5; margin-bottom: 24px; }}
        .otp-box {{ background: #F0F4F8; border: 2px dashed #1E88E5; border-radius: 10px; padding: 18px 24px; display: inline-block; margin: 8px 0 20px 0; }}
        .otp-code {{ font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0D47A1; font-family: 'Courier New', monospace; }}
        .timer {{ font-size: 13px; color: #d73a49; font-weight: 600; margin-top: 6px; }}
        .footer {{ background: #FAFAFA; padding: 16px; text-align: center; border-top: 1px solid #e1e4e8; font-size: 12px; color: #6a737d; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>B-MAP</h1>
            <p>Smart Navigation Platform</p>
        </div>
        <div class="content">
            <div class="greeting">Verify Your Email</div>
            <div class="message">
                Please enter the 6-digit verification code below to complete your {flow_title.lower()}:
            </div>
            <div class="otp-box">
                <div class="otp-code">{code}</div>
            </div>
            <div class="timer">⏰ Valid for 5 minutes</div>
        </div>
        <div class="footer">
            If you did not request this email, please ignore it.<br>
            &copy; 2026 B-Map Team. All rights reserved.
        </div>
    </div>
</body>
</html>
"""

        msg.attach(MIMEText(text_body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))

        try:
            await asyncio.to_thread(self._send_mail_sync, email, msg)
            logger.info(f"Email OTP sent successfully to {email}")
            return {"status": "sent", "email": email}
        except Exception as e:
            logger.error(f"Failed to send email via SMTP to {email}: {e}")
            if settings.ENV == "development" or email.endswith("@example.com"):
                logger.warning(f"SMTP failed in dev, falling back to mock OTP: {code}")
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
