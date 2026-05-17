from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, Union

class Settings(BaseSettings):
    PROJECT_NAME: str = "B-Map Backend"
    ENV: str = "development"
    
    # Security & CORS
    CORS_ORIGINS: list[str] = ["*"]
    SECURE_HEADERS_ENABLED: bool = True
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, list[str]]) -> list[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                return json.loads(v)
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]
    
    # Database
    DB_HOST: Optional[str] = None
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_NAME: Optional[str] = None
    DB_PORT: str = "5432"
    DB_SSLMODE: str = "disable"
    
    # Database Pool Tuning
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 1800
    DB_POOL_TIMEOUT: int = 30
    
    @property
    def DATABASE_URL(self) -> str:
        if not all([self.DB_USER, self.DB_PASSWORD, self.DB_HOST, self.DB_NAME]):
            return "sqlite+aiosqlite:///./test.db" # Fallback for build/local test
        import urllib.parse
        encoded_user = urllib.parse.quote_plus(self.DB_USER)
        encoded_password = urllib.parse.quote_plus(self.DB_PASSWORD)
        return f"postgresql+psycopg://{encoded_user}:{encoded_password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?sslmode={self.DB_SSLMODE}"

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

