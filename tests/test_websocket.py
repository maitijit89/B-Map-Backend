import pytest
from fastapi.testclient import TestClient
from fastapi import WebSocketDisconnect
from unittest.mock import patch, MagicMock
from app.core.security import create_access_token
from tests.conftest import MOCK_USER, MOCK_USER_ID

def test_websocket_missing_token(client):
    with client.websocket_connect("/ws") as websocket:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            websocket.receive_json()
        assert exc_info.value.code == 1008

def test_websocket_invalid_token(client, mock_db):
    mock_db.users.find_one.return_value = None
    with client.websocket_connect("/ws?token=invalid_token_value") as websocket:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            websocket.receive_json()
        assert exc_info.value.code == 1008

def test_websocket_authenticated_success_and_sync(client, mock_db):
    # Setup mock user in database
    mock_db.users.find_one.return_value = MOCK_USER.to_dict()
    
    # Generate valid access token
    token = create_access_token(MOCK_USER_ID)
    
    with client.websocket_connect(f"/ws?token={token}") as websocket:
        # Send location update payload
        websocket.send_json({
            "type": "LOCATION_UPDATE",
            "lat": 39.9042,
            "lng": 116.4074
        })
        
        # Verify it broadcasts LOCATION_SYNC to the user's sessions (blocking wait)
        sync_msg = websocket.receive_json()
        assert sync_msg["type"] == "LOCATION_SYNC"
        assert sync_msg["lat"] == 39.9042
        assert sync_msg["lng"] == 116.4074
        assert "timestamp" in sync_msg
        
        # Now verify it inserts into db.timeline
        mock_db.timeline.insert_one.assert_called_once()
