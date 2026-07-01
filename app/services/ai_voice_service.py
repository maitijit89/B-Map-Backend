import logging
from typing import Dict, Any
from app.services.navigation_service import NavigationService
from app.services.environment_service import EnvironmentService

logger = logging.getLogger(__name__)

class AIVoiceService:
    def __init__(self):
        self.nav_service = NavigationService()
        self.env_service = EnvironmentService()

    async def process_voice_command(self, query: str) -> Dict[str, Any]:
        cleaned_query = query.strip()
        
        # Check for wake word
        wake_word = "gemini ai"
        if wake_word not in cleaned_query.lower():
            return {
                "success": False,
                "error": "Missing wake word. Please start your command with 'Gemini ai'.",
                "wake_word_detected": False
            }

        # Remove wake word from processing
        idx = cleaned_query.lower().find(wake_word)
        command_text = cleaned_query[idx + len(wake_word):].strip(",. ").strip()

        # NLP logic parsing: routing vs weather vs nearby
        command_lower = command_text.lower()
        
        if "route to" in command_lower or "navigate to" in command_lower or "directions to" in command_lower:
            # e.g., "route to Beijing Station"
            dest = command_text.split("to", 1)[-1].strip()
            directions = await self.nav_service.get_directions(origin="Current Location", destination=dest, mode="driving")
            return {
                "success": True,
                "wake_word_detected": True,
                "intent": "NAVIGATION",
                "speech_response": f"Calculating directions to {dest}. Total distance is {directions['routes'][0]['legs'][0]['distance']['text']}.",
                "data": directions
            }
            
        elif "weather" in command_lower or "rain" in command_lower or "forecast" in command_lower:
            # Weather query
            weather = await self.env_service.get_weather(lat=39.9042, lng=116.4074, query_type="current")
            return {
                "success": True,
                "wake_word_detected": True,
                "intent": "WEATHER",
                "speech_response": "Currently it is clear in Beijing with a temperature of 24 degrees Celsius.",
                "data": weather
            }
            
        elif "search along my route" in command_lower or "find" in command_lower or "nearby" in command_lower:
            # Nearby query
            return {
                "success": True,
                "wake_word_detected": True,
                "intent": "NEARBY_SEARCH",
                "speech_response": "Searching for charging stations and restrooms along your active route. Found 3 matches.",
                "data": {
                    "results": [
                        {"name": "EV Fast Charger", "distance_meters": 350},
                        {"name": "Public Restroom Plaza", "distance_meters": 780}
                    ]
                }
            }
            
        else:
            return {
                "success": True,
                "wake_word_detected": True,
                "intent": "GENERAL_QUERY",
                "speech_response": f"I heard you say: '{command_text}'. How can B-Map help you today?",
                "data": {}
            }
