from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import HTTPException, status
from app.db.models import User
from app.schemas.user import UserCreate, UserLogin, AuthResponse, UserResponse, UserMeResponse, GamificationProgress
from typing import Optional
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

    def create_temp_verification_token(self, phone_number: str) -> str:
        from app.core.config import settings
        from jose import jwt
        from datetime import datetime, timedelta, timezone
        
        expire = datetime.now(timezone.utc) + timedelta(minutes=10)
        to_encode = {"exp": expire, "sub": f"temp_verify:{phone_number}"}
        encoded_jwt = jwt.encode(
            to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
        )
        return encoded_jwt

    def verify_temp_verification_token(self, token: str) -> str:
        from app.core.config import settings
        from jose import jwt, JWTError
        try:
            payload = jwt.decode(
                token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
            )
            sub: str = payload.get("sub", "")
            if not sub.startswith("temp_verify:"):
                raise ValueError("Invalid token type")
            return sub.split(":", 1)[1]
        except (JWTError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid or expired temporary verification token: {str(e)}"
            )

    async def register_mobile(
        self,
        temp_token: str,
        display_name: str,
        gender: Optional[str] = None,
        dob: Optional[str] = None,
        profile_pic_url: Optional[str] = None
    ) -> AuthResponse:
        phone_number = self.verify_temp_verification_token(temp_token)
        
        # Check if user already exists
        user_doc = await self.db.users.find_one({"phone_number": phone_number})
        if user_doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this phone number already exists"
            )
            
        user = User(
            display_name=display_name,
            phone_number=phone_number,
            gender=gender,
            dob=dob,
            profile_pic_url=profile_pic_url
        )
        await self.db.users.insert_one(user.to_dict())
        
        token = create_access_token(user.id)
        return AuthResponse(
            token=token,
            user=UserResponse.model_validate(user)
        )

    async def register_email(
        self,
        temp_token: str,
        display_name: str,
        gender: Optional[str] = None,
        dob: Optional[str] = None,
        profile_pic_url: Optional[str] = None
    ) -> AuthResponse:
        email = self.verify_temp_verification_token(temp_token)
        
        # Check if user already exists
        user_doc = await self.db.users.find_one({"email": email})
        if user_doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
            
        user = User(
            display_name=display_name,
            email=email,
            gender=gender,
            dob=dob,
            profile_pic_url=profile_pic_url
        )
        await self.db.users.insert_one(user.to_dict())
        
        token = create_access_token(user.id)
        return AuthResponse(
            token=token,
            user=UserResponse.model_validate(user)
        )

    async def delete_account(self, user: User) -> bool:
        # Delete user document
        await self.db.users.delete_one({"_id": user.id})
        
        # Clean up all associated data
        await self.db.reviews.delete_many({"user_id": user.id})
        await self.db.incidents.delete_many({"reporter_id": user.id})
        await self.db.pins.delete_many({"user_id": user.id})
        await self.db.timeline.delete_many({"user_id": user.id})
        await self.db.shortcuts.delete_many({"user_id": user.id})
        await self.db.sync_sessions.delete_many({"user_id": user.id})
        await self.db.user_lists.delete_many({"user_id": user.id})
        
        return True

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
