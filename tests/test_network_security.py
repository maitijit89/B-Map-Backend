import pytest
from app.core.config import settings

def test_security_headers_present(client):
    response = client.get("/health")
    assert response.status_code == 200
    
    headers = response.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("X-XSS-Protection") == "1; mode=block"
    assert "max-age=31536000" in headers.get("Strict-Transport-Security", "")
    assert "default-src 'self'" in headers.get("Content-Security-Policy", "")
    assert "frame-ancestors 'none'" in headers.get("Content-Security-Policy", "")
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "camera=()" in headers.get("Permissions-Policy", "")


def test_cors_trusted_origins_configuration():
    origins = settings.CORS_ORIGINS
    assert isinstance(origins, list)
    assert len(origins) > 0
    # Must include trusted domains
    assert "https://bmap.io" in origins or "https://b-map-backend.vercel.app" in origins


def test_https_enforcement_middleware(client):
    # Set ENFORCE_HTTPS = True temporarily
    original_setting = settings.ENFORCE_HTTPS
    try:
        settings.ENFORCE_HTTPS = True
        
        # Test HTTP unencrypted request forwarded via reverse proxy
        http_headers = {"x-forwarded-proto": "http"}
        res_http = client.get("/health", headers=http_headers)
        assert res_http.status_code == 403
        assert "unencrypted http connections are rejected" in res_http.json()["detail"].lower()

        # Test HTTPS encrypted request forwarded via reverse proxy
        https_headers = {"x-forwarded-proto": "https"}
        res_https = client.get("/health", headers=https_headers)
        assert res_https.status_code == 200
    finally:
        settings.ENFORCE_HTTPS = original_setting
