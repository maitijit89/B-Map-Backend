import os
# Force testing environment before importing the app
os.environ["ENV"] = "testing"

import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock
from uuid import uuid4
from fastapi.testclient import TestClient

# Override settings to force SQLite database url
from app.core.config import settings
settings.DB_USER = None
settings.DB_PASSWORD = None
settings.DB_NAME = None
settings.DB_HOST = None
settings.GOOGLE_PLACES_API_KEY = "mock_key"
settings.REDIS_HOST = None
settings.REDIS_URL = None

from app.main import app
from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.db.models import User

# Sample User for Mock Authentication
MOCK_USER_ID = uuid4()
MOCK_USER = User(
    id=MOCK_USER_ID,
    email="testuser@example.com",
    password_hash="mockhashedpassword"
)

# Mock DB Session
class MockAsyncSession:
    def __init__(self):
        self.add = MagicMock()
        self.commit = AsyncMock()
        self.flush = AsyncMock(side_effect=self._mock_refresh)
        self.refresh = AsyncMock(side_effect=self._mock_refresh)
        self.delete = AsyncMock()
        self.execute = AsyncMock()

    async def _mock_refresh(self, *args, **kwargs):
        if not args:
            return
        instance = args[0]
        import uuid
        from datetime import datetime
        if hasattr(instance, "id") and getattr(instance, "id", None) is None:
            instance.id = uuid.uuid4()
        if hasattr(instance, "created_at") and getattr(instance, "created_at", None) is None:
            instance.created_at = datetime.utcnow()
        if hasattr(instance, "timestamp") and getattr(instance, "timestamp", None) is None:
            instance.timestamp = datetime.utcnow()


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def mock_db():
    return MockAsyncSession()

@pytest.fixture
def client(mock_db):
    # Override get_db dependency
    async def override_get_db():
        yield mock_db
        
    # Override authentication dependency
    async def override_get_current_user():
        return MOCK_USER
        
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    with TestClient(app) as test_client:
        yield test_client
        
    app.dependency_overrides.clear()
