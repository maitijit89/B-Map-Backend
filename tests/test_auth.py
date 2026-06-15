from unittest.mock import patch, MagicMock
from app.db.models import User

def test_register_and_login_functional(client, mock_db):
    # Mock database responses for user lookup
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None  # user doesn't exist
    mock_db.execute.return_value = mock_result

    # Verify regular register
    response_register = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "securepassword123",
        "display_name": "Test User"
    })
    assert response_register.status_code == 200
    data_reg = response_register.json()
    assert "token" in data_reg
    assert data_reg["user"]["email"] == "test@example.com"
    assert data_reg["user"]["display_name"] == "Test User"

    # Mock database returns user for login
    from app.db.models import User
    from app.core.security import get_password_hash
    import uuid
    from datetime import datetime, UTC
    mock_user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        password_hash=get_password_hash("securepassword123"),
        display_name="Test User",
        created_at=datetime.now(UTC)
    )
    mock_result_login = MagicMock()
    mock_result_login.scalars.return_value.first.return_value = mock_user
    mock_db.execute.return_value = mock_result_login

    # Verify regular login
    response_login = client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "securepassword123"
    })
    assert response_login.status_code == 200
    data_login = response_login.json()
    assert "token" in data_login
    assert data_login["user"]["email"] == "test@example.com"

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


@patch("app.services.firebase_service.FirebaseService.verify_id_token")
def test_firebase_login_new_user(mock_verify, client, mock_db):
    # Mock Firebase token verification response
    mock_verify.return_value = {
        "email": "firebaseuser@example.com",
        "name": "Firebase User",
        "uid": "firebase-uid-123"
    }

    # Mock DB returns None (user does not exist yet)
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    mock_db.execute.return_value = mock_result

    payload = {
        "id_token": "valid_mock_firebase_id_token"
    }

    response = client.post("/api/v1/auth/firebase", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] == "firebaseuser@example.com"
    assert data["user"]["display_name"] == "Firebase User"


@patch("app.services.firebase_service.FirebaseService.verify_id_token")
def test_firebase_login_existing_user(mock_verify, client, mock_db):
    # Mock Firebase token verification response
    mock_verify.return_value = {
        "email": "firebaseuser@example.com",
        "name": "Firebase User",
        "uid": "firebase-uid-123"
    }

    # Mock DB returns existing user
    mock_user = User(
        email="firebaseuser@example.com",
        password_hash="somepasswordhash",
        display_name="Old Firebase Name"
    )
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = mock_user
    mock_db.execute.return_value = mock_result

    payload = {
        "id_token": "valid_mock_firebase_id_token"
    }

    response = client.post("/api/v1/auth/firebase", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["display_name"] == "Firebase User"


@patch("app.services.firebase_service.FirebaseService.verify_id_token")
def test_firebase_phone_login_new_user(mock_verify, client, mock_db):
    # Mock Firebase phone verification token response
    mock_verify.return_value = {
        "phone_number": "+1234567890",
        "uid": "firebase-phone-uid-123"
    }

    # Mock DB returns None for all lookups (user does not exist)
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    mock_db.execute.return_value = mock_result

    payload = {
        "id_token": "valid_mock_firebase_phone_token"
    }

    response = client.post("/api/v1/auth/firebase", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] is None
    assert data["user"]["phone_number"] == "+1234567890"
    assert data["user"]["firebase_uid"] == "firebase-phone-uid-123"


@patch("app.services.firebase_service.FirebaseService.verify_id_token")
def test_firebase_phone_login_existing_user(mock_verify, client, mock_db):
    # Mock Firebase phone verification token response
    mock_verify.return_value = {
        "phone_number": "+1234567890",
        "uid": "firebase-phone-uid-123"
    }

    # Mock DB returns existing user with same phone number
    mock_user = User(
        phone_number="+1234567890",
        password_hash="somepasswordhash",
        display_name="Phone User"
    )
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = mock_user
    mock_db.execute.return_value = mock_result

    payload = {
        "id_token": "valid_mock_firebase_phone_token"
    }

    response = client.post("/api/v1/auth/firebase", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["phone_number"] == "+1234567890"
    assert data["user"]["firebase_uid"] == "firebase-phone-uid-123"


