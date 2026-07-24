import uuid
import logging
from typing import Dict, Any, List
from app.features.safety.models import EmergencyContact, LiveSessionCreate, SOSRequest
from app.shared.integrations.twilio_service import TwilioService

logger = logging.getLogger(__name__)

class SafetyService:
    def __init__(self):
        self.twilio = TwilioService()
        # Mock database for emergency contacts and sessions
        self.mock_contacts = [
            EmergencyContact(name="Mom", phone_number="+919876543210", relation="Family"),
            EmergencyContact(name="Dad", phone_number="+919876543211", relation="Family")
        ]

    async def get_emergency_contacts(self, user_id: str) -> List[EmergencyContact]:
        return self.mock_contacts

    async def start_live_tracking(self, user_id: str, data: LiveSessionCreate) -> Dict[str, Any]:
        session_id = str(uuid.uuid4())
        # In a real app, save to MongoDB with TTL
        return {
            "session_id": session_id,
            "shareable_url": f"https://b-map.app/live/{session_id}",
            "status": "active"
        }

    async def trigger_sos(self, user_id: str, data: SOSRequest) -> Dict[str, Any]:
        contacts = await self.get_emergency_contacts(user_id)
        if not contacts:
            return {"success": False, "error": "No emergency contacts found"}
        
        # Build maps URL
        maps_link = f"https://www.google.com/maps?q={data.lat},{data.lng}"
        sms_body = f"SOS Alert from B-Map User: {data.message}\nLocation: {maps_link}"
        
        # We catch exceptions to prevent failing the entire SOS flow if one SMS fails
        for contact in contacts:
            try:
                # In production, we actually fire SMS if credentials are valid
                # For safety, we log it heavily
                await self.twilio.send_sms(to_number=contact.phone_number, body=sms_body)
                logger.info(f"SOS sent to {contact.name} ({contact.phone_number})")
            except Exception as e:
                logger.error(f"Failed to send SOS to {contact.phone_number}: {e}")
                
        return {"success": True, "message": f"SOS sent to {len(contacts)} contacts."}
