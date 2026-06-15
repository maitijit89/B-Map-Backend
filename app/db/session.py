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
        "pool_pre_ping": True,  # Periodically test connections to discard stale sockets
        "connect_args": {"connect_timeout": 3}
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


async def init_db() -> None:
    """
    Ensures that database tables are created, and runs dynamic migrations for local development (SQLite).
    """
    logger.info("Initializing database schema...")
    
    # 1. Handle dynamic migration for local SQLite development
    if settings.DATABASE_URL.startswith("sqlite"):
        import sqlite3
        db_path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")
        
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
            table_exists = cursor.fetchone()
            
            if table_exists:
                cursor.execute("PRAGMA table_info(users)")
                columns = [col[1] for col in cursor.fetchall()]
                
                if "phone_number" not in columns:
                    logger.info("Local SQLite: Adding 'phone_number' column to users table.")
                    cursor.execute("ALTER TABLE users ADD COLUMN phone_number VARCHAR")
                    
                if "firebase_uid" not in columns:
                    logger.info("Local SQLite: Adding 'firebase_uid' column to users table.")
                    cursor.execute("ALTER TABLE users ADD COLUMN firebase_uid VARCHAR")
            
            conn.commit()
            conn.close()
        except Exception as e:
            logger.warning(f"Failed to perform local SQLite migration: {e}")
            
    # 2. Run create_all to create any missing tables
    try:
        # Import models to register them on Base.metadata
        from app.db import models
        _ = models
        
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise e


