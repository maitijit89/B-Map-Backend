import logging
from typing import List, Dict
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Map user_id (str) to list of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Keep track of all raw connections for quick broadcasting
        self.all_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        self.all_connections.append(websocket)
        logger.info(f"New WebSocket connection accepted for user {user_id}. Total users: {len(self.active_connections)}. Total connections: {len(self.all_connections)}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections and websocket in self.active_connections[user_id]:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        if websocket in self.all_connections:
            self.all_connections.remove(websocket)
        logger.info(f"WebSocket connection closed for user {user_id}. Total users: {len(self.active_connections)}. Total connections: {len(self.all_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            for connection in list(self.active_connections[user_id]):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
                    self.disconnect(connection, user_id)

    async def broadcast(self, message: dict):
        logger.info(f"Broadcasting message to {len(self.all_connections)} connections: {message}")
        # Make a copy of list to avoid issues if items are removed during iteration
        for connection in list(self.all_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to connection: {e}")
                # Search for connection to disconnect cleanly
                found_user_id = None
                for uid, conns in list(self.active_connections.items()):
                    if connection in conns:
                        found_user_id = uid
                        break
                if found_user_id:
                    self.disconnect(connection, found_user_id)
                elif connection in self.all_connections:
                    self.all_connections.remove(connection)

manager = ConnectionManager()
