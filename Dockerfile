# Production Dockerfile for B-Map Backend
FROM python:3.11-slim as builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Final Production Image
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

COPY --from=builder /install /usr/local
COPY . /app

# Create unprivileged user for execution
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/app/static/uploads && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

CMD ["gunicorn", "-c", "gunicorn.conf.py", "app.main:app"]
