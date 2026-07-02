import os
# Force testing environment before importing the app
os.environ["ENV"] = "testing"

import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock
from uuid import uuid4
from fastapi.testclient import TestClient

# Override settings to force SQLite database url (cleaned up for MongoDB)
from app.core.config import settings
settings.MONGODB_URL = "mongodb://localhost:27017"
settings.MONGODB_DB_NAME = "b_map_test"
settings.GOOGLE_PLACES_API_KEY = "mock_key"
settings.REDIS_HOST = None
settings.REDIS_URL = None

from app.main import app
from app.db.session import get_db
from app.api.v1.deps import get_current_user, get_current_user_optional
from app.db.models import User

# Sample User for Mock Authentication
MOCK_USER_ID = uuid4()
MOCK_USER = User(
    id=MOCK_USER_ID,
    email="testuser@example.com",
    password_hash="mockhashedpassword"
)

class MockCursor:
    def __init__(self, results):
        self.results = results or []
        self.index = 0

    def sort(self, *args, **kwargs):
        return self

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.index >= len(self.results):
            raise StopAsyncIteration
        val = self.results[self.index]
        self.index += 1
        return val

    async def to_list(self, length=None):
        if length is not None:
            return self.results[:length]
        return self.results

class MockCollection:
    def __init__(self):
        self.find_one = AsyncMock(return_value=None)
        self.insert_one = AsyncMock(return_value=MagicMock(inserted_id=uuid4()))
        self.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
        self.delete_many = AsyncMock(return_value=MagicMock(deleted_count=1))
        self.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

        self.replace_one = AsyncMock(return_value=MagicMock(modified_count=1))
        self.find = MagicMock(return_value=MockCursor([]))
        self.aggregate = MagicMock(return_value=MockCursor([]))
        self.count_documents = AsyncMock(return_value=0)

class MockMotorDatabase:
    def __init__(self):
        self.users = MockCollection()
        self.incidents = MockCollection()
        self.places = MockCollection()
        self.pins = MockCollection()
        self.timeline = MockCollection()
        self.user_lists = MockCollection()
        self.reviews = MockCollection()
        self.shortcuts = MockCollection()
        self.parking = MockCollection()
        self.panoramas = MockCollection()
        self.indoor_floor_plans = MockCollection()
        self.sync_sessions = MockCollection()

    async def command(self, cmd):
        if cmd == "ping":
            return {"ok": 1.0}
        return {}

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def mock_db():
    return MockMotorDatabase()

@pytest.fixture
def client(mock_db):
    # Override get_db dependency
    async def override_get_db():
        yield mock_db
        
    # Override authentication dependency
    async def override_get_current_user():
        return MOCK_USER
        
    async def override_get_current_user_optional():
        return MOCK_USER
        
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_user_optional] = override_get_current_user_optional
    
    with TestClient(app) as test_client:
        yield test_client
        
    app.dependency_overrides.clear()
