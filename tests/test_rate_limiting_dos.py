import pytest
from app.core.config import settings
from app.main import limiter

@pytest.fixture(autouse=True)
def enable_rate_limiting():
    settings.ENABLE_RATE_LIMITING_FOR_TESTS = True
    limiter.requests.clear()
    yield
    settings.ENABLE_RATE_LIMITING_FOR_TESTS = False
    limiter.requests.clear()

def test_rate_limit_headers_and_throttling(client):
    res = client.get("/api/v1/auth/splash-ads")
    assert res.status_code == 200
    assert "X-RateLimit-Limit" in res.headers
    assert "X-RateLimit-Remaining" in res.headers
    assert int(res.headers["X-RateLimit-Limit"]) == settings.RATE_LIMIT_REQUESTS_PER_MINUTE


def test_sensitive_endpoint_strict_throttling(client):
    login_payload = {"email": "test@bmap.io", "password": "wrongpassword"}
    
    # Trigger 5 requests (strict limit = 5)
    for i in range(5):
        res = client.post("/api/v1/auth/login", json=login_payload)
        # Should be 400 (invalid creds) or 422, but not 429 yet
        assert res.status_code != 429
        
    # The 6th request must be throttled with HTTP 429 Too Many Requests
    res_throttled = client.post("/api/v1/auth/login", json=login_payload)
    assert res_throttled.status_code == 429
    assert "Retry-After" in res_throttled.headers
    assert int(res_throttled.headers["Retry-After"]) >= 1
    assert res_throttled.json()["detail"] == "Too Many Requests"


def test_oversized_payload_rejected(client):
    # Simulate content-length exceeding 10 MB (e.g., 15 MB = 15728640 bytes)
    headers = {"Content-Length": str(15 * 1024 * 1024), "Content-Type": "application/json"}
    
    response = client.post("/api/v1/navigation/multimodal-plan", headers=headers, content=b"{}")
    assert response.status_code == 413
    assert response.json()["detail"] == "Payload Too Large"
