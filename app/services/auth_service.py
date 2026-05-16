from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException, status
from app.db.models import User
from app.schemas.user import UserCreate, UserLogin, AuthResponse, UserResponse
from app.core.security import get_password_hash, verify_password, create_access_token

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, user_in: UserCreate) -> AuthResponse:
        # Check if user exists
        result = await self.db.execute(select(User).where(User.email == user_in.email))
        if result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        user = User(
            email=user_in.email,
            password_hash=get_password_hash(user_in.password),
            display_name=user_in.display_name
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        
        token = create_access_token(user.id)
        return AuthResponse(
            token=token,
            user=UserResponse.from_orm(user)
        )

    async def login(self, user_in: UserLogin) -> AuthResponse:
        result = await self.db.execute(select(User).where(User.email == user_in.email))
        user = result.scalars().first()
        
        if not user or not verify_password(user_in.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
            
        token = create_access_token(user.id)
        return AuthResponse(
            token=token,
            user=UserResponse.from_orm(user)
        )
