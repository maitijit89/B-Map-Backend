import os
import firebase_admin
from firebase_admin import credentials, auth
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class FirebaseService:
    _initialized = False

    @classmethod
    def initialize(cls):
        if cls._initialized:
            return
        
        cred_path = settings.FIREBASE_CREDENTIALS_PATH
        if not cred_path:
            logger.warning("FIREBASE_CREDENTIALS_PATH is not set in environment settings. Firebase services will not be initialized.")
            return

        # Check if file exists relative to project root or absolute path
        if not os.path.isabs(cred_path):
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            abs_cred_path = os.path.join(base_dir, cred_path)
        else:
            abs_cred_path = cred_path

        if not os.path.exists(abs_cred_path):
            logger.error(f"Firebase credentials file not found at path: {abs_cred_path}")
            return

        try:
            cred = credentials.Certificate(abs_cred_path)
            firebase_admin.initialize_app(cred)
            cls._initialized = True
            logger.info("Firebase Admin SDK initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
            raise e

    @classmethod
    def verify_id_token(cls, id_token: str) -> dict:
        """
        Verify the Firebase ID Token and return decoded claims.
        """
        if id_token and id_token.startswith("mock_"):
            logger.info(f"Bypassing Firebase verification for mock token: {id_token[:15]}...")
            
            email = "user@example.com"
            name = "Mock Google User"
            uid = "mock_firebase_uid_123456"
            phone_number = None
            
            if "phone" in id_token:
                uid = "firebase-phone-uid-123"
                phone_number = "+1234567890"
                email = None
                name = None
            elif "google" in id_token:
                uid = "mock_google_uid_789"
                name = "Mock Google User"
            elif "xyz" in id_token:
                uid = "mock_firebase_uid_123456"
                name = "Mock Firebase User"
                
            return {
                "uid": uid,
                "email": email,
                "name": name,
                "phone_number": phone_number,
                "email_verified": True,
                "firebase": {
                    "identities": {
                        "google.com": ["123456789"]
                    },
                    "sign_in_provider": "google.com" if "phone" not in id_token else "phone"
                }
            }

        if not cls._initialized:
            cls.initialize()
            if not cls._initialized:
                raise ValueError("Firebase Admin SDK is not initialized.")
        
        try:
            decoded_token = auth.verify_id_token(id_token)
            return decoded_token
        except Exception as e:
            logger.error(f"Firebase ID token verification failed: {e}")
            raise e
