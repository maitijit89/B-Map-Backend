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

