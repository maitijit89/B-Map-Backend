from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.core.config import settings
import asyncio
import logging

logger = logging.getLogger(__name__)

# Create engine with production-ready connection pool tuning
engine_args = {
    "echo": True if settings.ENV == "development" else False,
    "future": True
}

if settings.DATABASE_URL.startswith("postgresql"):
    engine_args.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_recycle": settings.DB_POOL_RECYCLE,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
        "pool_pre_ping": True  # Periodically test connections to discard stale sockets
    })

engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_args
)

AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def verify_db_connection(max_retries: int = 5, retry_interval: float = 2.0) -> bool:
    """
    Attempts to establish a database connection with exponential backoff.
    """
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Verifying database connection... (Attempt {attempt}/{max_retries})")
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            logger.info("Database connection verified successfully!")
            return True
        except Exception as e:
            logger.warning(f"Database connection failed on attempt {attempt}: {e}")
            if attempt == max_retries:
                logger.error("Could not establish database connection after multiple retries.")
                return False
            # Exponential backoff
            sleep_time = retry_interval * (2 ** (attempt - 1))
            logger.info(f"Retrying database connection in {sleep_time:.2f} seconds...")
            await asyncio.sleep(sleep_time)
    return False

