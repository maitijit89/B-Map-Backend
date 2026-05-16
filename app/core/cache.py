import redis.asyncio as redis
import json
from typing import Any, Optional
from app.core.config import settings

class Cache:
    def __init__(self):
        self.redis = None
        if settings.REDIS_URL:
            self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

    async def get(self, key: str) -> Optional[Any]:
        if not self.redis:
            return None
        data = await self.redis.get(key)
        if data:
            return json.loads(data)
        return None

    async def set(self, key: str, value: Any, expire: int = 3600):
        if not self.redis:
            return
        await self.redis.set(key, json.dumps(value), ex=expire)

cache = Cache()
