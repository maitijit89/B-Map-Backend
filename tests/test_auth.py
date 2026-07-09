from unittest.mock import patch
from app.db.models import User
import uuid
from datetime import datetime, timezone

def test_register_and_login_functional(client, mock_db):
    # Mock database user lookup to return None (user doesn't exist)
    mock_db.users.find_one.return_value = None

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
    from app.core.security import get_password_hash
    mock_user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        password_hash=get_password_hash("securepassword123"),
        display_name="Test User",
        created_at=datetime.now(timezone.utc)
    )
    mock_db.users.find_one.return_value = mock_user.to_dict()

    # Verify regular login
    response_login = client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "securepassword123"
    })
    assert response_login.status_code == 200
    data_login = response_login.json()
    assert "token" in data_login
    assert data_login["user"]["email"] == "test@example.com"


def test_register_missing_fields_fail(client, mock_db):
    # Verify register fails without email
    response = client.post("/api/v1/auth/register", json={
        "password": "securepassword123",
        "display_name": "Test User"
    })
    assert response.status_code == 400
    assert "Email and display name are required" in response.json()["detail"]

    # Verify register fails without display_name
    response = client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "securepassword123"
    })
    assert response.status_code == 400
    assert "Email and display name are required" in response.json()["detail"]


def test_firebase_uid_excluded_from_response(client, mock_db):
    from app.core.security import get_password_hash
    mock_user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        password_hash=get_password_hash("securepassword123"),
        display_name="Test User",
        firebase_uid="mock_firebase_uid",
        created_at=datetime.now(timezone.utc)
    )
    mock_db.users.find_one.return_value = mock_user.to_dict()

    response = client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "securepassword123"
    })
    assert response.status_code == 200
    res_data = response.json()
    assert "firebase_uid" not in res_data["user"]


@patch("app.services.twilio_service.TwilioService.send_otp")
def test_dynamic_rate_limiting_block_message_email_and_phone(mock_send, client, mock_db):
    from datetime import timedelta
    # Test phone block message
    mock_send.return_value = {"status": "pending"}
    mock_db.users.find_one.return_value = None
    mock_db.otp_attempts.find_one.return_value = {
        "phone_number": "+15550100",
        "flow": "signup",
        "blocked_until": datetime.now(timezone.utc) + timedelta(minutes=10)
    }
    response = client.post("/api/v1/auth/otp/send", json={"phone_number": "+15550100", "flow": "signup"})
    assert response.status_code == 429
    assert "Phone number is temporarily blocked" in response.json()["detail"]

    # Test email block message
    mock_db.otp_attempts.find_one.return_value = {
        "identifier": "test@example.com",
        "flow": "signup",
        "blocked_until": datetime.now(timezone.utc) + timedelta(minutes=10)
    }
    response = client.post("/api/v1/auth/otp/send", json={"email": "test@example.com", "flow": "signup"})
    assert response.status_code == 429
    assert "Email is temporarily blocked" in response.json()["detail"]



