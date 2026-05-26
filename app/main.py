# pyrefly: ignore [missing-import]
import sys
import os
import asyncio

# Resolve ProactorEventLoop issue on Windows with psycopg async
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uuid
import time
from collections import defaultdict
# Ensure the parent directory is in sys.path to support running directly as `python app/main.py`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.logging_config import setup_logging
setup_logging()

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api.v1 import auth, incidents, places, navigation, pins, reviews, lists, timeline, offline
import logging

logger = logging.getLogger(__name__)

from contextlib import asynccontextmanager
from app.db.session import verify_db_connection

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info("Initializing application startup services...")
    db_ok = await verify_db_connection(max_retries=3, retry_interval=1.0)
    if not db_ok:
        logger.error("Database connection check failed! Proceeding anyway, but database dependent operations may fail.")
    yield
    # Shutdown logic
    logger.info("Shutting down application services...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/api/v1/openapi.json",
    docs_url="/docs",
    lifespan=lifespan,
    servers=[
        {"url": "https://b-map-backend.vercel.app", "description": "Production environment"},
        {"url": "http://localhost:8080", "description": "Local development"}
    ]
)

# Custom In-Memory Rate Limiter
class InMemoryRateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests = defaultdict(list)
        
    def is_allowed(self, ip: str) -> bool:
        now = time.time()
        # Keep only timestamps within the last 60 seconds
        self.requests[ip] = [t for t in self.requests[ip] if now - t < 60]
        if len(self.requests[ip]) >= self.requests_per_minute:
            return False
        self.requests[ip].append(now)
        return True

limiter = InMemoryRateLimiter(settings.RATE_LIMIT_REQUESTS_PER_MINUTE)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"Global error [Request ID: {request_id}]: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error",
            "message": str(exc) if settings.ENV == "development" else "A system error occurred. Please contact support.",
            "request_id": request_id
        },
    )

# Middlewares
@app.middleware("http")
async def add_request_id_and_timing(request: Request, call_next):
    # Correlation ID
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    
    # Set request ID in contextvar for automated tracing in all logs
    from app.core.logging_config import request_id_var
    token = request_id_var.set(request_id)
    
    try:
        start_time = time.time()
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        
        # Inject request tracing headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
        
        # Log request metrics in structured/JSON format
        logger.info(
            f"Request: {request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.2f}ms",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "latency_ms": round(process_time, 2),
                "ip": request.client.host if request.client else "unknown"
            }
        )
        return response
    finally:
        # Reset context variable state to prevent leaking tracing context to other threads/requests
        request_id_var.reset(token)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    if settings.SECURE_HEADERS_ENABLED:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    # Bypass docs, static assets, and health checks
    if request.url.path in ["/", "/health", "/docs", "/openapi.json", "/api/v1/openapi.json"]:
        return await call_next(request)
        
    client_ip = request.client.host if request.client else "unknown"
    if not limiter.is_allowed(client_ip):
        logger.warning(f"Rate limit exceeded for IP: {client_ip} on path: {request.url.path}")
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "detail": "Too Many Requests",
                "message": "Rate limit exceeded. Please wait a moment before trying again."
            },
        )
    return await call_next(request)

# Set all CORS enabled origins dynamically from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(incidents.router, prefix="/api/v1/incidents", tags=["Incidents"])
app.include_router(places.router, prefix="/api/v1/places", tags=["Places"])
app.include_router(navigation.router, prefix="/api/v1/navigation", tags=["Navigation"])
app.include_router(pins.router, prefix="/api/v1/pins", tags=["User Pins"])
app.include_router(reviews.router, prefix="/api/v1/reviews", tags=["Reviews & Ratings"])
app.include_router(lists.router, prefix="/api/v1/lists", tags=["Saved Lists"])
app.include_router(timeline.router, prefix="/api/v1/timeline", tags=["Timeline & History"])
app.include_router(offline.router, prefix="/api/v1/offline", tags=["Offline Pre-fetching"])

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
    
    # Conditional run to enforce asyncio.WindowsSelectorEventLoopPolicy on Windows
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        uvicorn.run(app, host="0.0.0.0", port=port)
    else:
        uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=is_dev)

