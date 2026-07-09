from unittest.mock import patch, AsyncMock
from app.db.models import User
import pytest
from uuid import uuid4
from datetime import datetime, timezone, timedelta

def test_send_email_otp_signup_success(client, mock_db):
    mock_db.users.find_one.return_value = None
    mock_db.otp_attempts.find_one.return_value = None
    
    response = client.post("/api/v1/auth/otp/send", json={"email": "newuser@example.com", "flow": "signup"})
    assert response.status_code == 200
    assert "Signup OTP sent successfully" in response.json()["message"]

def test_send_email_otp_signup_already_registered(client, mock_db):
    mock_db.users.find_one.return_value = {"email": "existing@example.com", "display_name": "Test User"}
    
    response = client.post("/api/v1/auth/otp/send", json={"email": "existing@example.com", "flow": "signup"})
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"]

def test_send_email_otp_login_success(client, mock_db):
    mock_db.users.find_one.return_value = {"email": "existing@example.com", "display_name": "Test User"}
    mock_db.otp_attempts.find_one.return_value = None
    
    response = client.post("/api/v1/auth/otp/send", json={"email": "existing@example.com", "flow": "login"})
    assert response.status_code == 200
    assert "Login OTP sent successfully" in response.json()["message"]

def test_send_email_otp_login_not_registered(client, mock_db):
    mock_db.users.find_one.return_value = None
    
    response = client.post("/api/v1/auth/otp/send", json={"email": "nonexistent@example.com", "flow": "login"})
    assert response.status_code == 400
    assert "not registered" in response.json()["detail"]

def test_send_email_otp_resend_success(client, mock_db):
    mock_db.users.find_one.return_value = None
    mock_db.otp_attempts.find_one.return_value = None
    
    response = client.post("/api/v1/auth/otp/send", json={"email": "newuser@example.com", "flow": "signup", "is_resend": True})
    assert response.status_code == 200
    assert "OTP resent successfully" in response.json()["message"]

def test_verify_email_otp_flow_signup_success(client, mock_db):
    mock_db.otp_verifications.find_one.return_value = {
        "_id": "verification_id",
        "identifier": "newuser@example.com",
        "code": "123456",
        "flow": "signup",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    mock_db.users.find_one.return_value = None
    
    response = client.post("/api/v1/auth/otp/verify", json={"email": "newuser@example.com", "code": "123456", "flow": "signup"})
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["registered"] is False
    assert "temp_token" in res_data
    mock_db.otp_verifications.delete_one.assert_called_once()

def test_verify_email_otp_invalid_code(client, mock_db):
    mock_db.otp_verifications.find_one.return_value = None
    
    response = client.post("/api/v1/auth/otp/verify", json={"email": "newuser@example.com", "code": "111111", "flow": "signup"})
    assert response.status_code == 400
    assert "Invalid or expired OTP" in response.json()["detail"]

def test_verify_email_otp_flow_signup_already_registered(client, mock_db):
    mock_db.otp_verifications.find_one.return_value = {
        "_id": "verification_id",
        "identifier": "existing@example.com",
        "code": "123456",
        "flow": "signup",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    mock_db.users.find_one.return_value = {"email": "existing@example.com", "display_name": "Test User"}
    
    response = client.post("/api/v1/auth/otp/verify", json={"email": "existing@example.com", "code": "123456", "flow": "signup"})
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"]

def test_verify_email_otp_flow_login_success(client, mock_db):
    mock_db.otp_verifications.find_one.return_value = {
        "_id": "verification_id",
        "identifier": "existing@example.com",
        "code": "123456",
        "flow": "login",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    
    existing_user = User(
        id=uuid4(),
        display_name="Existing User",
        email="existing@example.com",
        gender="male",
        dob="1990-01-01"
    )
    mock_db.users.find_one.return_value = existing_user.to_dict()
    
    response = client.post("/api/v1/auth/otp/verify", json={"email": "existing@example.com", "code": "123456", "flow": "login"})
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["registered"] is True
    assert "token" in res_data
    assert res_data["user"]["email"] == "existing@example.com"

def test_register_email_success(client, mock_db):
    mock_db.users.find_one.return_value = None
    
    from app.services.auth_service import AuthService
    auth_service = AuthService(mock_db)
    temp_token = auth_service.create_temp_verification_token("newuser@example.com")
    
    response = client.post("/api/v1/auth/register-email", data={
        "temp_token": temp_token,
        "display_name": "New Email User",
        "gender": "female",
        "dob": "1992-02-02"
    })
    
    assert response.status_code == 200
    res_data = response.json()
    assert "token" in res_data
    assert res_data["user"]["email"] == "newuser@example.com"
    assert res_data["user"]["display_name"] == "New Email User"
    assert res_data["user"]["gender"] == "female"
    assert res_data["user"]["dob"] == "1992-02-02"
    mock_db.users.insert_one.assert_called_once()

def test_send_otp_both_identifiers_fail(client):
    response = client.post("/api/v1/auth/otp/send", json={
        "phone_number": "+15550100",
        "email": "test@example.com",
        "flow": "signup"
    })
    assert response.status_code == 400
    assert "Exactly one of phone_number or email" in response.json()["detail"]

def test_send_otp_neither_identifier_fail(client):
    response = client.post("/api/v1/auth/otp/send", json={
        "flow": "signup"
    })
    assert response.status_code == 400
    assert "Exactly one of phone_number or email" in response.json()["detail"]

def test_verify_otp_both_identifiers_fail(client):
    response = client.post("/api/v1/auth/otp/verify", json={
        "phone_number": "+15550100",
        "email": "test@example.com",
        "code": "123456"
    })
    assert response.status_code == 400
    assert "Exactly one of phone_number or email" in response.json()["detail"]

def test_verify_otp_neither_identifier_fail(client):
    response = client.post("/api/v1/auth/otp/verify", json={
        "code": "123456"
    })
    assert response.status_code == 400
    assert "Exactly one of phone_number or email" in response.json()["detail"]

def test_verify_otp_optional_flow_success(client, mock_db):
    mock_db.otp_verifications.find_one.return_value = {
        "_id": "verification_id",
        "identifier": "newuser@example.com",
        "code": "123456",
        "flow": "signup",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    mock_db.users.find_one.return_value = None
    
    response = client.post("/api/v1/auth/otp/verify", json={
        "email": "newuser@example.com",
        "code": "123456"
    })
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["registered"] is False
    assert "temp_token" in res_data

