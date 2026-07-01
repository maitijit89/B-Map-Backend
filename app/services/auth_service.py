from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import HTTPException, status
from app.db.models import User
from app.schemas.user import UserCreate, UserLogin, GoogleLogin, FirebaseLogin, AuthResponse, UserResponse, UserMeResponse, GamificationProgress
from app.core.security import get_password_hash, verify_password, create_access_token

class AuthService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def register(self, user_in: UserCreate) -> AuthResponse:
        # Check if user exists
        user_doc = await self.db.users.find_one({"email": user_in.email})
        if user_doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        user = User(
            email=user_in.email,
            password_hash=get_password_hash(user_in.password),
            display_name=user_in.display_name
        )
        await self.db.users.insert_one(user.to_dict())
        
        token = create_access_token(user.id)
        return AuthResponse(
            token=token,
            user=UserResponse.model_validate(user)
        )

    async def login(self, user_in: UserLogin) -> AuthResponse:
        user_doc = await self.db.users.find_one({"email": user_in.email})
        user = User.from_dict(user_doc)
        
        if not user or not verify_password(user_in.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
            
        token = create_access_token(user.id)
        return AuthResponse(
            token=token,
            user=UserResponse.model_validate(user)
        )

    async def login_google(self, google_login: GoogleLogin) -> AuthResponse:
        from google.oauth2 import id_token
        from google.auth.transport import requests
        import uuid
        from app.core.config import settings

        try:
            # Verify the token against Google Client ID
            id_info = id_token.verify_oauth2_token(
                google_login.id_token,
                requests.Request(),
                settings.GOOGLE_CLIENT_ID
            )
            
            # Verify the issuer
            if id_info.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
                raise ValueError("Wrong token issuer.")
                
            email = id_info.get("email")
            display_name = id_info.get("name")
            
            if not email:
                raise ValueError("Email not found in Google token.")
                
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Google ID token: {str(e)}"
            )

        # Check if the user already exists in the database
        user_doc = await self.db.users.find_one({"email": email})
        user = User.from_dict(user_doc)
        
        if not user:
            # Create user with a secure random password since they sign in via Google
            random_password = str(uuid.uuid4())
            user = User(
                email=email,
                password_hash=get_password_hash(random_password),
                display_name=display_name
            )
            await self.db.users.insert_one(user.to_dict())
        else:
            # Update their display name if it changed in Google
            if display_name and user.display_name != display_name:
                user.display_name = display_name
                await self.db.users.update_one(
                    {"_id": user.id},
                    {"$set": {"display_name": display_name}}
                )

        token = create_access_token(user.id)
        return AuthResponse(
            token=token,
            user=UserResponse.model_validate(user)
        )

    async def login_firebase(self, firebase_login: FirebaseLogin) -> AuthResponse:
        from app.services.firebase_service import FirebaseService
        import uuid

        try:
            # Verify Firebase ID token
            decoded_token = FirebaseService.verify_id_token(firebase_login.id_token)
            
            email = decoded_token.get("email")
            display_name = decoded_token.get("name")
            phone_number = decoded_token.get("phone_number")
            firebase_uid = decoded_token.get("uid") or decoded_token.get("sub")
            
            if not firebase_uid:
                raise ValueError("UID not found in Firebase ID token.")
                
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Firebase ID token: {str(e)}"
            )

        # Look up user:
        # 1. By firebase_uid
        user = None
        user_doc = await self.db.users.find_one({"firebase_uid": firebase_uid})
        user = User.from_dict(user_doc)
        
        # 2. By email (if email is present in the token)
        if not user and email:
            user_doc = await self.db.users.find_one({"email": email})
            user = User.from_dict(user_doc)
            if user:
                # Link existing user by email
                user.firebase_uid = firebase_uid
                
        # 3. By phone_number (if phone_number is present in the token)
        if not user and phone_number:
            user_doc = await self.db.users.find_one({"phone_number": phone_number})
            user = User.from_dict(user_doc)
            if user:
                # Link existing user by phone
                user.firebase_uid = firebase_uid

        # Upsert logic:
        if not user:
            # Create user with a secure random password since they sign in via Firebase
            random_password = str(uuid.uuid4())
            user = User(
                email=email,
                password_hash=get_password_hash(random_password),
                display_name=display_name,
                phone_number=phone_number,
                firebase_uid=firebase_uid
            )
            await self.db.users.insert_one(user.to_dict())
        else:
            # Update fields if changed
            updated = False
            if display_name and user.display_name != display_name:
                user.display_name = display_name
                updated = True
            if email and user.email != email:
                user.email = email
                updated = True
            if phone_number and user.phone_number != phone_number:
                user.phone_number = phone_number
                updated = True
            if not user.firebase_uid:
                user.firebase_uid = firebase_uid
                updated = True
                
            if updated:
                await self.db.users.replace_one({"_id": user.id}, user.to_dict())

        token = create_access_token(user.id)
        return AuthResponse(
            token=token,
            user=UserResponse.model_validate(user)
        )

    async def get_user_profile(self, user: User) -> UserMeResponse:
        # Count user's contributions
        reviews_count = await self.db.reviews.count_documents({"user_id": user.id})
        incidents_count = await self.db.incidents.count_documents({"reporter_id": user.id})
        pins_count = await self.db.pins.count_documents({"user_id": user.id})

        # Calculate XP
        xp = (reviews_count * 50) + (incidents_count * 100) + (pins_count * 20)

        level = 1
        next_level_xp = 100
        current_level_base = 0

        if xp >= 1000:
            level = 5
            next_level_xp = 1000
            current_level_base = 1000
        elif xp >= 600:
            level = 4
            next_level_xp = 1000
            current_level_base = 600
        elif xp >= 300:
            level = 3
            next_level_xp = 600
            current_level_base = 300
        elif xp >= 100:
            level = 2
            next_level_xp = 300
            current_level_base = 100

        # Calculate progress percentage
        if level == 5:
            xp_progress_pct = 100.0
        else:
            denom = next_level_xp - current_level_base
            xp_progress_pct = round(((xp - current_level_base) / denom) * 100, 2) if denom > 0 else 0.0

        # Dynamic Badges
        badges = []
        if level >= 1:
            badges.append("LV.1 VIP")
        if reviews_count >= 5:
            badges.append("Reviewer Bronze")
        if incidents_count >= 3:
            badges.append("Road Safety Pioneer")
        if pins_count >= 10:
            badges.append("Mapper Extraordinaire")

        contribution_count = reviews_count + incidents_count + pins_count

        return UserMeResponse(
            user=UserResponse.model_validate(user),
            gamification=GamificationProgress(
                level=level,
                xp=xp,
                next_level_xp=next_level_xp,
                xp_progress_pct=xp_progress_pct,
                contribution_count=contribution_count,
                badges=badges
            )
        )
