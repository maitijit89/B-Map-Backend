# pyrefly: ignore [missing-import]
import sys
import os
import asyncio
import uuid
import time
import logging
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status, WebSocket, WebSocketDisconnect, Depends
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse

from app.core.websocket import manager

from app.core.logging_config import setup_logging
from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import verify_db_connection, get_db

# Simple in‑memory token bucket rate limiter
class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window_seconds
        self.allowance = max_requests
        self.last_check = time.time()

    async def dispatch(self, request: Request, call_next):
        current = time.time()
        time_passed = current - self.last_check
        self.last_check = current
        self.allowance += time_passed * (self.max_requests / self.window)
        if self.allowance > self.max_requests:
            self.allowance = self.max_requests
        if self.allowance < 1:
            # Too many requests – return 429 with Retry‑After header
            retry_after = int(self.window - (self.max_requests - self.allowance) * self.window / self.max_requests)
            return Response(status_code=429, content="Too Many Requests", headers={"Retry-After": str(retry_after)})
        self.allowance -= 1
        response = await call_next(request)
        return response

# Resolve ProactorEventLoop issue on Windows with psycopg async
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Ensure the parent directory is in sys.path to support running directly as `python app/main.py`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

setup_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info("Initializing application startup services...")
    
    # Initialize Firebase Admin SDK
    from app.services.firebase_service import FirebaseService
    try:
        FirebaseService.initialize()
    except Exception as e:
        logger.error(f"Firebase initialization failed during startup: {e}")
        
    db_ok = await verify_db_connection(max_retries=3, retry_interval=1.0)
    if not db_ok:
        logger.error("Database connection check failed! Proceeding anyway, but database dependent operations may fail.")
    else:
        from app.db.session import init_db
        try:
            await init_db()
        except Exception as e:
            logger.error(f"Database schema initialization failed: {e}")
    yield
    # Shutdown logic
    logger.info("Shutting down application services...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/api/v1/openapi.json",
    docs_url="/docs",
    lifespan=lifespan,
    servers=[
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
# Include centralized api_router with V1 prefix
app.include_router(api_router, prefix="/api/v1")

# Root-level router aliases to match Flutter client relative pathing
app.include_router(api_router)

from fastapi.staticfiles import StaticFiles
# Create static/uploads directory if not exists
try:
    os.makedirs("app/static/uploads", exist_ok=True)
except Exception as e:
    logger.warning(f"Could not create static uploads directory: {e}")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def root():
    try:
        with open("app/static/index.html", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return HTMLResponse("Welcome to B-Map API. Developer console not found.", status_code=404)

@app.get("/health")
@app.get("/health")
async def health_check():
    db_ok = await verify_db_connection(max_retries=1, retry_interval=0.5)
    return {"status": "healthy", "db_connected": db_ok}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, db = Depends(get_db)):
    token = websocket.query_params.get("token")
    if not token:
        logger.warning("Rejected WebSocket connection: missing token.")
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing authentication token.")
        return

    from app.api.v1.deps import get_user_from_token
    
    user = await get_user_from_token(token, db)
    if not user:
        logger.warning("Rejected WebSocket connection: invalid token.")
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid authentication token.")
        return

    user_id_str = str(user.id)
    await manager.connect(websocket, user_id_str)
    
    try:
        while True:
            data = await websocket.receive_json()
            logger.info(f"Received websocket message from user {user_id_str}: {data}")
            
            if isinstance(data, dict) and data.get("type") == "LOCATION_UPDATE":
                lat = data.get("lat")
                lng = data.get("lng")
                if lat is not None and lng is not None:
                    # Update/insert user location into timeline
                    location_doc = {
                        "type": "Point",
                        "coordinates": [float(lng), float(lat)]
                    }
                    
                    from app.db.models import Timeline
                    timeline_entry = Timeline(user_id=user.id, location=location_doc)
                    await db.timeline.insert_one(timeline_entry.to_dict())
                    
                    # Sync to other sessions of the same user
                    sync_payload = {
                        "type": "LOCATION_SYNC",
                        "lat": lat,
                        "lng": lng,
                        "timestamp": timeline_entry.timestamp.isoformat()
                    }
                    await manager.send_to_user(user_id_str, sync_payload)
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id_str)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id_str}: {e}")
        manager.disconnect(websocket, user_id_str)

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

