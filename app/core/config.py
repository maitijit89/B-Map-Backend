from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "B-Map Backend"
    ENV: str = "development"
    
    # Database
    DB_HOST: Optional[str] = None
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_NAME: Optional[str] = None
    DB_PORT: str = "5432"
    DB_SSLMODE: str = "disable"
    
    @property
    def DATABASE_URL(self) -> str:
        if not all([self.DB_USER, self.DB_PASSWORD, self.DB_HOST, self.DB_NAME]):
            return "sqlite+aiosqlite:///./test.db" # Fallback for build/local test
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?ssl={self.DB_SSLMODE}"

    # Redis
    REDIS_URL: Optional[str] = None
    
    # Auth
    JWT_SECRET: str = "b_map_secure_secret_2026_fallback"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    
    # Google Auth
    GOOGLE_PLACES_API_KEY: Optional[str] = None
    GOOGLE_CLIENT_ID: Optional[str] = None
    
    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"
    }

settings = Settings()
