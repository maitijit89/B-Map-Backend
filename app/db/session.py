from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import asyncio
import logging

logger = logging.getLogger(__name__)

# Cache variables for Motor Client and Database
client = None
db = None

def get_mongodb_client():
    global client, db
    if client is None:
        mongodb_url = settings.MONGODB_URL
        logger.info(f"Connecting to MongoDB at {mongodb_url}")
        client = AsyncIOMotorClient(
            mongodb_url,
            uuidRepresentation="standard",
            serverSelectionTimeoutMS=2000,
            maxPoolSize=100,
            minPoolSize=10,
            retryWrites=True
        )
        db = client[settings.MONGODB_DB_NAME]
    return client, db

async def get_db():
    _, database = get_mongodb_client()
    yield database

async def verify_db_connection(max_retries: int = 5, retry_interval: float = 2.0) -> bool:
    """
    Attempts to connect to MongoDB and pings the database server.
    """
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Verifying MongoDB connection... (Attempt {attempt}/{max_retries})")
            _, database = get_mongodb_client()
            await database.command("ping")
            logger.info("MongoDB connection verified successfully!")
            return True
        except Exception as e:
            logger.warning(f"MongoDB connection failed on attempt {attempt}: {e}")
            if attempt == max_retries:
                logger.error("Could not establish MongoDB connection after multiple retries.")
                return False
            sleep_time = retry_interval * (2 ** (attempt - 1))
            logger.info(f"Retrying MongoDB connection in {sleep_time:.2f} seconds...")
            await asyncio.sleep(sleep_time)
    return False

async def init_db() -> None:
    """
    Ensures that MongoDB collections have the correct unique and spatial (2dsphere) indexes.
    """
    logger.info("Initializing MongoDB schema and indexes...")
    _, database = get_mongodb_client()
    
    try:
        # Spatial 2dsphere indexes for geospatial queries
        await database.incidents.create_index([("location", "2dsphere")])
        await database.places.create_index([("location", "2dsphere")])
        await database.pins.create_index([("location", "2dsphere")])
        await database.timeline.create_index([("location", "2dsphere")])
        await database.parking.create_index([("location", "2dsphere")])
        await database.panoramas.create_index([("location", "2dsphere")])
        await database.indoor_floor_plans.create_index([("location", "2dsphere")])
        await database.shortcuts.create_index([("location", "2dsphere")])
        
        # Unique and sparse lookup indexes
        await database.users.create_index("email", unique=True, sparse=True)
        await database.users.create_index("phone_number", unique=True, sparse=True)
        await database.users.create_index("firebase_uid", unique=True, sparse=True)
        
        # Unique place id
        await database.places.create_index("google_place_id", unique=True)
        
        # Unique device id for sync sessions
        await database.sync_sessions.create_index("device_id", unique=True)
        
        logger.info("MongoDB indexes created successfully.")
    except Exception as e:
        logger.error(f"Failed to create MongoDB indexes: {e}")
        raise e
