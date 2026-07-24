"""
Central FastAPI dependencies re-export shim.
"""
from app.shared.dependencies import (
    reusable_oauth2,
    reusable_oauth2_optional,
    get_current_user,
    get_current_user_optional,
    get_user_from_token,
    get_db,
)
