from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.config import settings
from app.db.session import get_db
from app.db.models import User
from uuid import UUID
from typing import Optional

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/google"
)

reusable_oauth2_optional = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/google",
    auto_error=False
)

async def get_current_user(
    db: AsyncIOMotorDatabase = Depends(get_db),
    token: str = Depends(reusable_oauth2)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
        
    user_doc = await db.users.find_one({"_id": UUID(user_id)})
    user = User.from_dict(user_doc)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def get_current_user_optional(
    db: AsyncIOMotorDatabase = Depends(get_db),
    token: Optional[str] = Depends(reusable_oauth2_optional)
) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
        
    user_doc = await db.users.find_one({"_id": UUID(user_id)})
    user = User.from_dict(user_doc)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def get_user_from_token(token: str, db: AsyncIOMotorDatabase) -> Optional[User]:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        user_doc = await db.users.find_one({"_id": UUID(user_id)})
        return User.from_dict(user_doc)
    except Exception:
        return None

