"""
Database session module (re-exports from app.core.database for backwards compatibility).
"""
from app.core.database import (
    get_mongodb_client,
    get_db,
    verify_db_connection,
    init_db,
    close_mongodb_client
)
