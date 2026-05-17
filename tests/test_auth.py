import pytest
from unittest.mock import patch, MagicMock
from app.db.models import User

def test_register_and_login_disabled(client):
    # Verify regular register is disabled (returns 404)
    response_register = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "securepassword123",
        "display_name": "Test User"
    })
    assert response_register.status_code == 404

    # Verify regular login is disabled (returns 404)
    response_login = client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "securepassword123"
    })
    assert response_login.status_code == 404

@patch("google.oauth2.id_token.verify_oauth2_token")
def test_google_login_new_user(mock_verify, client, mock_db):
    # Mock Google Token Verification response
    mock_verify.return_value = {
        "iss": "accounts.google.com",
        "email": "googleuser@example.com",
        "name": "Google User",
        "sub": "google-user-id-123"
    }

    # Mock DB returns None (user does not exist yet)
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    mock_db.execute.return_value = mock_result

    payload = {
        "id_token": "valid_mock_google_id_token"
    }

    response = client.post("/api/v1/auth/google", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] == "googleuser@example.com"
    assert data["user"]["display_name"] == "Google User"

@patch("google.oauth2.id_token.verify_oauth2_token")
def test_google_login_existing_user(mock_verify, client, mock_db):
    # Mock Google Token Verification response
    mock_verify.return_value = {
        "iss": "accounts.google.com",
        "email": "googleuser@example.com",
        "name": "Google User",
        "sub": "google-user-id-123"
    }

    # Mock DB returns existing user
    mock_user = User(
        email="googleuser@example.com",
        password_hash="somepasswordhash",
        display_name="Old Name"
    )
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = mock_user
    mock_db.execute.return_value = mock_result

    payload = {
        "id_token": "valid_mock_google_id_token"
    }

    response = client.post("/api/v1/auth/google", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    # Display name should be updated to "Google User"
    assert data["user"]["display_name"] == "Google User"
