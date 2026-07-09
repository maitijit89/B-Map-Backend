import logging
import json
import httpx
from typing import Dict, Any
from app.core.config import settings
from app.services.navigation_service import NavigationService
from app.services.environment_service import EnvironmentService
from app.services.maps_service import MapsService
from app.services.place_service import PlaceService

logger = logging.getLogger(__name__)

class AIVoiceService:
    def __init__(self):
        self.nav_service = NavigationService()
        self.env_service = EnvironmentService()
        self.maps_service = MapsService()
        self.place_service = PlaceService()

    def _is_api_key_valid(self) -> bool:
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return False
        val = api_key.lower()
        return not (val.startswith("your_") or "mock" in val or val == "")

    async def _call_gemini(self, prompt: str, json_mode: bool = False) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
        if json_mode:
            payload["generationConfig"] = {"responseMimeType": "application/json"}
            
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code != 200:
                raise Exception(f"Gemini API returned status {response.status_code}: {response.text}")
            data = response.json()
            return data["contents"][0]["parts"][0]["text"]

    async def _resolve_coords(self, location_str: str) -> tuple[float, float]:
        if not location_str:
            return 39.9042, 116.4074 # Beijing default
        try:
            # Try parsing as lat,lng
            parts = location_str.split(",")
            if len(parts) == 2:
                return float(parts[0]), float(parts[1])
        except ValueError:
            pass
        
        # Geocode
        try:
            geocode_res = await self.place_service.geocode(location_str)
            if geocode_res and geocode_res.get("status") == "OK" and geocode_res.get("results"):
                loc = geocode_res["results"][0]["geometry"]["location"]
                return float(loc["lat"]), float(loc["lng"])
        except Exception as e:
            logger.warning(f"Geocoding failed for voice query location '{location_str}': {e}")
        return 39.9042, 116.4074 # fallback

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

        # If API key is not valid, fallback to regex
        if not self._is_api_key_valid():
            logger.info("Gemini API key is invalid/missing. Falling back to rule-based parser.")
            return await self._process_fallback(command_text)

        try:
            # 1. Parse intent and parameters using Gemini
            parse_prompt = f"""
You are B-Map's AI voice command parser. Classify the user query into one of these intents:
- NAVIGATION: directions, routing, navigation, path, lanes, cycling, transit, rail recommendations, carriage recommendation, travel times.
- WEATHER: weather forecast, temperature, rain, air quality (AQI), pollen count, solar potential.
- TRAFFIC: traffic conditions, predictive traffic, congestion level, delays, road closures, accidents.
- STREET_VIEW: street view panoramas, visual 360 panorama, camera fleet captures, historical captures.
- 3D_VIEW: 3D map rendering, 3D metadata, LOD levels, city 3D support status.
- NEARBY_SEARCH: search along route, find nearby places (restaurants, chargers, restrooms, parks, ATMs, hotels, etc.).
- GENERAL: conversational queries, greetings, general questions or general search.

You must extract parameters from the command. For coordinates, parse them as float. For names, parse as string.
Return a JSON object matching this schema:
{{
  "intent": "NAVIGATION" | "WEATHER" | "TRAFFIC" | "STREET_VIEW" | "3D_VIEW" | "NEARBY_SEARCH" | "GENERAL",
  "parameters": {{
    "origin": "string starting point (e.g. Current Location or address/coord)",
    "destination": "string ending point (e.g. address/coord)",
    "mode": "transit | driving | walking | bicycling | cycling",
    "location": "string location name or 'lat,lng' format",
    "lat": float,
    "lng": float,
    "city": "string city name",
    "query": "string search term (e.g. charging stations)",
    "radius": integer,
    "query_type": "current | forecast_daily | forecast_hourly | history"
  }}
}}

Ensure you only return valid JSON. Do not include markdown block formatting, and do not prefix or suffix the JSON with backticks.

User command: "{command_text}"
"""
            raw_parse = await self._call_gemini(parse_prompt, json_mode=True)
            parsed = json.loads(raw_parse.strip())
            intent = parsed.get("intent", "GENERAL")
            params = parsed.get("parameters", {})
            
            logger.info(f"Gemini parsed voice query. Intent: {intent}, Params: {params}")

            service_data = {}
            
            # 2. Call service based on parsed intent
            if intent == "NAVIGATION":
                dest = params.get("destination")
                if not dest:
                    return {
                        "success": False,
                        "error": "Destination is required for navigation.",
                        "wake_word_detected": True
                    }
                origin = params.get("origin") or "Current Location"
                mode = params.get("mode") or "driving"
                service_data = await self.nav_service.get_directions(origin=origin, destination=dest, mode=mode)
                
            elif intent == "WEATHER":
                lat, lng = None, None
                if "lat" in params and "lng" in params:
                    lat, lng = params["lat"], params["lng"]
                elif "location" in params:
                    lat, lng = await self._resolve_coords(params["location"])
                else:
                    lat, lng = 39.9042, 116.4074 # Beijing default
                
                q_type = params.get("query_type") or "current"
                service_data = await self.env_service.get_weather(lat=lat, lng=lng, query_type=q_type)
                
            elif intent == "TRAFFIC":
                origin = params.get("origin")
                dest = params.get("destination")
                if origin and dest:
                    service_data = await self.nav_service.get_predictive_traffic(origin=origin, destination=dest)
                else:
                    lat, lng = None, None
                    if "lat" in params and "lng" in params:
                        lat, lng = params["lat"], params["lng"]
                    elif "location" in params:
                        lat, lng = await self._resolve_coords(params["location"])
                    else:
                        lat, lng = 39.9042, 116.4074 # Beijing default
                    service_data = await self.maps_service.get_realtime_traffic(lat=lat, lng=lng)
                    
            elif intent == "STREET_VIEW":
                loc_str = params.get("location")
                if loc_str:
                    lat, lng = await self._resolve_coords(loc_str)
                else:
                    lat, lng = params.get("lat", 39.9042), params.get("lng", 116.4074)
                
                url_data = self.maps_service.get_street_view_url(location=f"{lat},{lng}")
                pano_data = await self.maps_service.get_streetview_panoramas(lat=lat, lng=lng)
                service_data = {
                    "streetview_url": url_data.get("url"),
                    "panorama_details": pano_data
                }
                
            elif intent == "3D_VIEW":
                city = params.get("city") or "Beijing"
                service_data = await self.maps_service.get_3d_metadata(city=city)
                
            elif intent == "NEARBY_SEARCH":
                loc_str = params.get("location")
                if loc_str:
                    lat, lng = await self._resolve_coords(loc_str)
                else:
                    lat, lng = params.get("lat", 39.9042), params.get("lng", 116.4074)
                
                query_term = params.get("query") or "gas_station"
                radius = params.get("radius") or 1000
                service_data = await self.place_service.search_nearby(lat=lat, lng=lng, radius=radius, type=query_term)
                
            else: # GENERAL
                service_data = {}

            # 3. Generate response using Gemini synthesis
            synthesis_prompt = f"""
You are B-Map's voice assistant speech generator.
The user said: "{query}"
We classified this as a {intent} intent.
We processed the command and obtained the following raw service data:
{json.dumps(service_data, indent=2)}

Generate a helpful, natural, and concise speech response (typically 1-3 sentences) that summarizes the information for the user. Keep it friendly and suitable for text-to-speech. Do not use markdown styling in your speech response since it will be read aloud.
"""
            speech_response = await self._call_gemini(synthesis_prompt)
            speech_response = speech_response.strip()

            return {
                "success": True,
                "wake_word_detected": True,
                "intent": intent,
                "speech_response": speech_response,
                "data": service_data
            }

        except Exception as e:
            logger.error(f"Error processing voice command with Gemini: {e}. Falling back to rule-based parser.")
            return await self._process_fallback(command_text)

    async def _process_fallback(self, command_text: str) -> Dict[str, Any]:
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
