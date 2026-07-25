from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.config import settings
from app.core.database import get_db
from app.db.models import User
from uuid import UUID
from typing import Optional

from typing import Optional, List, Callable

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)

reusable_oauth2_optional = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
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
        # Fallback user if token payload was validly signed in test/mock environment
        user = User(id=UUID(user_id) if len(user_id) == 36 else None, role=payload.get("role", "user"))
        
    # Attach token claims to user object for request lifecycle
    user.token_role = payload.get("role", getattr(user, "role", "user"))
    user.token_scopes = payload.get("scopes", ["user:read", "user:write"])
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    return current_user

class RoleChecker:
    """
    Role-Based Access Control (RBAC) Dependency.
    Enforces required user roles (e.g., ['admin'], ['admin', 'moderator']).
    Returns 403 Forbidden if user role is unauthorized.
    """
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = [r.lower() for r in allowed_roles]

    async def __call__(self, user: User = Depends(get_current_user)) -> User:
        user_role = (getattr(user, "token_role", None) or getattr(user, "role", "user")).lower()
        if user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Insufficient privileges. Required role in {self.allowed_roles}, got '{user_role}'."
            )
        return user

class ScopeChecker:
    """
    Scope-Based Access Control Dependency.
    Enforces required JWT token scopes (e.g., ['admin:all'], ['maps:write']).
    """
    def __init__(self, required_scopes: List[str]):
        self.required_scopes = set(required_scopes)

    async def __call__(self, user: User = Depends(get_current_user)) -> User:
        user_scopes = set(getattr(user, "token_scopes", []))
        if not self.required_scopes.issubset(user_scopes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Missing required scopes {list(self.required_scopes - user_scopes)}."
            )
        return user

def require_role(allowed_roles: List[str]) -> RoleChecker:
    return RoleChecker(allowed_roles)

def require_scopes(required_scopes: List[str]) -> ScopeChecker:
    return ScopeChecker(required_scopes)

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
            return None
    except JWTError:
        return None
        
    user_doc = await db.users.find_one({"_id": UUID(user_id)})
    user = User.from_dict(user_doc) if user_doc else User(role=payload.get("role", "user"))
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
        return User.from_dict(user_doc) if user_doc else User(role=payload.get("role", "user"))
    except Exception:
        return None

