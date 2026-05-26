# ==========================================
# STAGE 1: Builder
# ==========================================
FROM python:3.12-slim AS builder

# Prevent python from writing pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Install system compilation dependencies required for building Python wheels (if any)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set up clean virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and install wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ==========================================
# STAGE 2: Runner
# ==========================================
FROM python:3.12-slim AS runner

# Environment configs for runner
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=8080

WORKDIR /app

# Install runtime system dependencies (e.g., curl for health checks, libpq for PostgreSQL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv

# Create a non-privileged system user and group to execute the application
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -d /app -s /sbin/nologin -c "Application User" appuser

# Copy application source code
COPY --chown=appuser:appgroup app /app/app
COPY --chown=appuser:appgroup migrations /app/migrations
COPY --chown=appuser:appgroup alembic.ini /app/alembic.ini

# Ensure proper permissions for the application files
RUN chmod -R 755 /app

# Switch executing user context to the non-root system user
USER appuser

# Expose port
EXPOSE 8080

# Health check to monitor application health status in orchestration environments
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Start the FastAPI application using the PORT environment variable
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
