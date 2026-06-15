import redis.asyncio as redis
import json
import time
from typing import Any, Optional
from app.core.config import settings

class Cache:
    def __init__(self):
        self.redis = None
        self.local_store = {}
        if settings.REDIS_URL:
            try:
                self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
            except Exception:
                self.redis = None

    async def get(self, key: str) -> Optional[Any]:
        if self.redis:
            try:
                data = await self.redis.get(key)
                if data:
                    return json.loads(data)
            except Exception:
                pass
        
        # Fallback to local in-memory TTL cache
        if key in self.local_store:
            expire_at, value = self.local_store[key]
            if time.time() < expire_at:
                return value
            else:
                del self.local_store[key]
        return None

    async def set(self, key: str, value: Any, expire: int = 3600):
        if self.redis:
            try:
                await self.redis.set(key, json.dumps(value), ex=expire)
                return
            except Exception:
                pass
                
        # Fallback to local in-memory TTL cache
        self.local_store[key] = (time.time() + expire, value)

cache = Cache()
