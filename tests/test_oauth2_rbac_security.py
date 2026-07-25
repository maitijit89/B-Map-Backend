import pytest
import uuid
from datetime import timedelta
from app.main import app
from app.api.v1.deps import get_current_user
from app.core.security import create_access_token

def test_oauth2_token_creation_claims():
    user_id = str(uuid.uuid4())
    # 1. Create standard user token
    user_token = create_access_token(user_id, role="user", scopes=["user:read", "user:write"])
    assert user_token is not None
    assert isinstance(user_token, str)

    # 2. Create admin token with short expiration (15 min)
    admin_token = create_access_token(user_id, role="admin", expires_delta=timedelta(minutes=15))
    assert admin_token is not None


def test_standard_user_access_to_user_me(client):
    user_id = str(uuid.uuid4())
    user_token = create_access_token(user_id, role="user")
    headers = {"Authorization": f"Bearer {user_token}"}
    
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "user" in data
    assert "gamification" in data


def test_standard_user_forbidden_from_admin_dashboard(client):
    # Temporarily remove get_current_user mock override to test real RBAC role checking
    saved_override = app.dependency_overrides.pop(get_current_user, None)
    try:
        user_id = str(uuid.uuid4())
        user_token = create_access_token(user_id, role="user")
        headers = {"Authorization": f"Bearer {user_token}"}
        
        response = client.get("/api/v1/auth/admin/dashboard", headers=headers)
        assert response.status_code == 403
        data = response.json()
        assert "access denied" in data["detail"].lower() or "insufficient privileges" in data["detail"].lower()
    finally:
        if saved_override:
            app.dependency_overrides[get_current_user] = saved_override


def test_admin_user_allowed_on_admin_dashboard(client):
    # Temporarily remove get_current_user mock override to test real RBAC role checking
    saved_override = app.dependency_overrides.pop(get_current_user, None)
    try:
        admin_id = str(uuid.uuid4())
        admin_token = create_access_token(admin_id, role="admin")
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = client.get("/api/v1/auth/admin/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "AUTHORIZED"
        assert data["role"] == "admin"
        assert "system_metrics" in data
    finally:
        if saved_override:
            app.dependency_overrides[get_current_user] = saved_override


def test_expired_or_invalid_token_returns_401(client):
    # Temporarily remove get_current_user mock override to test real JWT token validation & expiration
    saved_override = app.dependency_overrides.pop(get_current_user, None)
    try:
        user_id = str(uuid.uuid4())
        expired_token = create_access_token(user_id, expires_delta=timedelta(seconds=-10))
        headers = {"Authorization": f"Bearer {expired_token}"}
        
        response = client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401

        # Completely invalid/garbage token
        headers_invalid = {"Authorization": "Bearer invalid_garbage_token_xyz"}
        res_inv = client.get("/api/v1/auth/me", headers=headers_invalid)
        assert res_inv.status_code == 401
    finally:
        if saved_override:
            app.dependency_overrides[get_current_user] = saved_override
