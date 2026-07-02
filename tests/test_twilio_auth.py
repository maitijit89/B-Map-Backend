from unittest.mock import patch, AsyncMock
from app.db.models import User
import pytest
from uuid import uuid4
from datetime import datetime, timezone

@patch("app.services.twilio_service.TwilioService.send_otp")
def test_send_otp_success(mock_send, client):
    mock_send.return_value = {"status": "pending"}
    
    response = client.post("/api/v1/auth/otp/send", json={"phone_number": "+15550100"})
    assert response.status_code == 200
    assert response.json()["message"] == "OTP sent successfully."
    mock_send.assert_called_once_with("+15550100")

@patch("app.services.twilio_service.TwilioService.verify_otp")
def test_verify_otp_existing_user(mock_verify, client, mock_db):
    mock_verify.return_value = True
    
    # Mock user in DB
    existing_user = User(
        id=uuid4(),
        display_name="Existing User",
        phone_number="+15550100",
        gender="female",
        dob="1995-05-15"
    )
    mock_db.users.find_one.return_value = existing_user.to_dict()
    
    response = client.post("/api/v1/auth/otp/verify", json={"phone_number": "+15550100", "code": "123456"})
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["registered"] is True
    assert "token" in res_data
    assert res_data["user"]["phone_number"] == "+15550100"
    assert res_data["user"]["display_name"] == "Existing User"
    assert res_data["user"]["gender"] == "female"
    assert res_data["user"]["dob"] == "1995-05-15"

@patch("app.services.twilio_service.TwilioService.verify_otp")
def test_verify_otp_new_user(mock_verify, client, mock_db):
    mock_verify.return_value = True
    
    # Mock user not found in DB
    mock_db.users.find_one.return_value = None
    
    response = client.post("/api/v1/auth/otp/verify", json={"phone_number": "+15550100", "code": "123456"})
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["registered"] is False
    assert "temp_token" in res_data
    assert res_data["token"] is None
    assert res_data["user"] is None

def test_register_mobile_success(client, mock_db):
    # Mock that phone number doesn't exist
    mock_db.users.find_one.return_value = None
    
    # Generate a temp token for registration
    from app.services.auth_service import AuthService
    auth_service = AuthService(mock_db)
    temp_token = auth_service.create_temp_verification_token("+15550100")
    
    # Send registration request
    response = client.post("/api/v1/auth/register-mobile", data={
        "temp_token": temp_token,
        "display_name": "New Mobile User",
        "gender": "male",
        "dob": "1990-01-01"
    })
    
    assert response.status_code == 200
    res_data = response.json()
    assert "token" in res_data
    assert res_data["user"]["phone_number"] == "+15550100"
    assert res_data["user"]["display_name"] == "New Mobile User"
    assert res_data["user"]["gender"] == "male"
    assert res_data["user"]["dob"] == "1990-01-01"
    mock_db.users.insert_one.assert_called_once()

def test_logout(client):
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully."

def test_delete_account(client, mock_db):
    # Call delete account (the client fixture automatically logs in mock_user)
    response = client.delete("/api/v1/auth/delete-account")
    assert response.status_code == 200
    assert response.json()["message"] == "Account permanently deleted."
    
    # Verify DB calls were made to wipe user details
    mock_db.users.delete_one.assert_called_once()
    mock_db.reviews.delete_many.assert_called_once()
    mock_db.incidents.delete_many.assert_called_once()
    mock_db.pins.delete_many.assert_called_once()
    mock_db.timeline.delete_many.assert_called_once()
    mock_db.shortcuts.delete_many.assert_called_once()
    mock_db.sync_sessions.delete_many.assert_called_once()
