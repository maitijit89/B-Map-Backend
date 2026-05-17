# pyrefly: ignore [missing-import]
import sys
import os
# Ensure the parent directory is in sys.path to support running directly as `python app/main.py`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api.v1 import auth, incidents, places, navigation, pins
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/api/v1/openapi.json",
    docs_url="/docs",
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "message": str(exc) if settings.ENV == "development" else None},
    )

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(incidents.router, prefix="/api/v1/incidents", tags=["Incidents"])
app.include_router(places.router, prefix="/api/v1/places", tags=["Places"])
app.include_router(navigation.router, prefix="/api/v1/navigation", tags=["Navigation"])
app.include_router(pins.router, prefix="/api/v1/pins", tags=["User Pins"])

@app.get("/")
async def root():
    return {"message": "Welcome to B-Map API (Python Version)"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    is_dev = settings.ENV == "development"
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=is_dev)
