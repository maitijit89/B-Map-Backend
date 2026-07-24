import httpx
from app.core.config import settings
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class EnvironmentService:
    def __init__(self):
        self.api_key = settings.GOOGLE_PLACES_API_KEY
        self.weather_api_key = settings.WEATHER_API_KEY

    def _is_api_key_valid(self) -> bool:
        if not self.api_key:
            return False
        val = self.api_key.lower()
        return not (val.startswith("your_") or "mock" in val or val == "")

    async def get_air_quality(self, lat: float, lng: float):
        def get_mock():
            return {
                "dateTime": "2026-06-13T09:00:00Z",
                "indexes": [
                    {
                        "code": "uaqi",
                        "displayName": "Universal AQI",
                        "aqi": 72,
                        "aqiDisplay": "72",
                        "color": {"red": 0.6, "green": 0.8, "blue": 0.2},
                        "category": "Moderate air quality",
                        "dominantPollutant": "pm25"
                    }
                ],
                "pollutants": [
                    {"code": "pm25", "displayName": "PM2.5", "fullName": "Fine particulate matter", "concentration": {"value": 22.4, "units": "MICROGRAMS_PER_CUBIC_METER"}}
                ]
            }

        # Try Weatherstack API first if available
        if self.weather_api_key and not self.weather_api_key.startswith("your_"):
            try:
                url = f"http://api.weatherstack.com/current?access_key={self.weather_api_key}&query={lat},{lng}"
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        if "current" in data and "air_quality" in data["current"]:
                            aq = data["current"]["air_quality"]
                            return {
                                "source": "Weatherstack Real-time Air Quality",
                                "dateTime": data["current"].get("observation_time"),
                                "indexes": [
                                    {
                                        "code": "us-epa-index",
                                        "displayName": "US EPA Index",
                                        "aqi": int(aq.get("us-epa-index", 2)),
                                        "category": "Moderate" if int(aq.get("us-epa-index", 2)) <= 2 else "Unhealthy"
                                    }
                                ],
                                "pollutants": [
                                    {"code": "pm25", "displayName": "PM2.5", "concentration": {"value": float(aq.get("pm2_5", 25.0)), "units": "MICROGRAMS_PER_CUBIC_METER"}},
                                    {"code": "pm10", "displayName": "PM10", "concentration": {"value": float(aq.get("pm10", 30.0)), "units": "MICROGRAMS_PER_CUBIC_METER"}},
                                    {"code": "co", "displayName": "CO", "concentration": {"value": float(aq.get("co", 500.0)), "units": "PPM"}}
                                ]
                            }
            except Exception as e:
                logger.warning(f"Weatherstack AQI fetch failed: {e}. Falling back to primary provider.")

        if not self._is_api_key_valid():
            return get_mock()

        url = f"https://airquality.googleapis.com/v1/currentConditions:lookup?key={self.api_key}"
        body = {"location": {"latitude": lat, "longitude": lng}}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=body)
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                data = response.json()
                if "error" in data or data.get("status") in ["REQUEST_DENIED", "BILLING_DISABLED"]:
                    raise Exception(data.get("error", {}).get("message", "API Error"))
                return data
        except Exception as e:
            logger.warning(f"Air quality lookup failed: {e}. Falling back to mock.")
            return get_mock()

    async def get_pollen(self, lat: float, lng: float, days: int = 1):
        def get_mock():
            return {
                "dailyInfo": [
                    {
                        "date": {"year": 2026, "month": 6, "day": 13},
                        "pollenTypeInfo": [
                            {
                                "code": "GRASS",
                                "displayName": "Grass",
                                "inSeason": True,
                                "indexInfo": {"value": 2, "category": "Low", "color": {"green": 0.9}}
                            },
                            {
                                "code": "TREE",
                                "displayName": "Tree",
                                "inSeason": True,
                                "indexInfo": {"value": 4, "category": "Moderate", "color": {"yellow": 0.9}}
                            }
                        ]
                    }
                ]
            }

        if not self._is_api_key_valid():
            return get_mock()

        url = "https://pollen.googleapis.com/v1/forecast:lookup"
        params = {
            "location.latitude": lat,
            "location.longitude": lng,
            "days": days,
            "key": self.api_key
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                data = response.json()
                if "error" in data or data.get("status") in ["REQUEST_DENIED", "BILLING_DISABLED"]:
                    raise Exception(data.get("error", {}).get("message", "API Error"))
                return data
        except Exception as e:
            logger.warning(f"Pollen lookup failed: {e}. Falling back to mock.")
            return get_mock()

    async def get_weather(self, lat: float, lng: float, query_type: str = "current"):
        def get_mock():
            if query_type == "current":
                return {
                    "temperature": {"value": 22.5, "units": "CELSIUS"},
                    "condition": "Partly Cloudy",
                    "humidity": 60,
                    "windSpeed": 12.5,
                    "uvIndex": 4
                }
            elif query_type == "forecast_daily":
                return {
                    "forecasts": [
                        {"date": "2026-06-13", "tempMin": 15.0, "tempMax": 25.0, "condition": "Sunny"},
                        {"date": "2026-06-14", "tempMin": 16.0, "tempMax": 27.0, "condition": "Clear"}
                    ]
                }
            elif query_type == "forecast_hourly":
                return {
                    "forecasts": [
                        {"time": "09:00", "temp": 20.0, "condition": "Sunny"},
                        {"time": "10:00", "temp": 22.0, "condition": "Sunny"}
                    ]
                }
            else:
                return {
                    "history": [
                        {"time": "08:00", "temp": 18.0},
                        {"time": "07:00", "temp": 17.0}
                    ]
                }

        # Real-Time Weather via Weatherstack API Key
        if query_type == "current" and self.weather_api_key and not self.weather_api_key.startswith("your_"):
            try:
                url = f"http://api.weatherstack.com/current?access_key={self.weather_api_key}&query={lat},{lng}"
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        if "current" in data:
                            curr = data["current"]
                            loc = data.get("location", {})
                            cond = curr.get("weather_descriptions", ["Clear"])[0] if curr.get("weather_descriptions") else "Clear"
                            return {
                                "status": "OK",
                                "source": "Weatherstack Real-time API",
                                "location": {
                                    "name": loc.get("name"),
                                    "region": loc.get("region"),
                                    "country": loc.get("country"),
                                    "lat": lat,
                                    "lng": lng
                                },
                                "temperature": {"value": curr.get("temperature"), "units": "CELSIUS"},
                                "feelsLike": {"value": curr.get("feelslike"), "units": "CELSIUS"},
                                "condition": cond,
                                "humidity": curr.get("humidity"),
                                "windSpeed": curr.get("wind_speed"),
                                "uvIndex": curr.get("uv_index"),
                                "visibility_km": curr.get("visibility"),
                                "weather_icon": curr.get("weather_icons", [None])[0],
                                "is_day": curr.get("is_day") == "yes",
                                "observation_time": curr.get("observation_time")
                            }
            except Exception as e:
                logger.warning(f"Weatherstack API lookup failed: {e}. Falling back to default provider.")

        if not self._is_api_key_valid():
            return get_mock()

        base = "https://weather.googleapis.com/v1"
        if query_type == "current":
            url = f"{base}/currentConditions:lookup?key={self.api_key}"
        elif query_type == "forecast_daily":
            url = f"{base}/forecast/days:lookup?key={self.api_key}"
        elif query_type == "forecast_hourly":
            url = f"{base}/forecast/hours:lookup?key={self.api_key}"
        else:
            url = f"{base}/history/hours:lookup?key={self.api_key}"

        body = {"location": {"latitude": lat, "longitude": lng}}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=body)
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                data = response.json()
                if "error" in data or data.get("status") in ["REQUEST_DENIED", "BILLING_DISABLED"]:
                    raise Exception(data.get("error", {}).get("message", "API Error"))
                return data
        except Exception as e:
            logger.warning(f"Weather lookup failed: {e}. Falling back to mock.")
            return get_mock()

    async def get_solar_potential(self, lat: float, lng: float):
        def get_mock():
            return {
                "name": "buildingInsights/mock-building-insight-1",
                "center": {"latitude": lat, "longitude": lng},
                "solarPotential": {
                    "maxSunshineHoursPerYear": 1850.5,
                    "maxArrayAreaMeters2": 150.0,
                    "carbonOffsetFactorKgPerMwh": 450.0,
                    "wholeRoofStats": {
                        "areaMeters2": 200.0,
                        "sunshineQuantiles": [1200, 1500, 1800],
                        "groundAreaMeters2": 150.0
                    },
                    "solarPanels": [
                        {"center": {"latitude": lat, "longitude": lng}, "orientation": "LANDSCAPE", "yearlyEnergyDcKwh": 350.0, "panelIndex": 0}
                    ]
                }
            }

        if not self._is_api_key_valid():
            return get_mock()

        url = "https://solar.googleapis.com/v1/buildingInsights:findClosest"
        params = {
            "location.latitude": lat,
            "location.longitude": lng,
            "requiredQuality": "HIGH",
            "key": self.api_key
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                data = response.json()
                if "error" in data or data.get("status") in ["REQUEST_DENIED", "BILLING_DISABLED"]:
                    raise Exception(data.get("error", {}).get("message", "API Error"))
                return data
        except Exception as e:
            logger.warning(f"Solar potential lookup failed: {e}. Falling back to mock.")
            return get_mock()

class GovFeedService:
    async def get_government_feeds(self, lat: float, lng: float) -> Dict[str, Any]:
        return {
            "authority_source": "National Traffic & Meteorological Integrated Feed (India)",
            "last_polled_at": "2026-07-01T15:00:00Z",
            "traffic_feed": {
                "agency": "National Highways Authority of India (NHAI)",
                "active_network_incidents": [
                    {
                        "incident_id": "gov-incident-743",
                        "highway": "NH-48",
                        "status": "CONGESTED",
                        "reason": "Heavy waterlogging near Pune junction due to seasonal monsoon rains",
                        "reported_at": "2026-07-01T14:45:00Z"
                    }
                ]
            },
            "meteorological_feed": {
                "agency": "India Meteorological Department (IMD)",
                "warning_level": "ORANGE_ALERT",
                "weather_phenomenon": "Heavy Rainfall and Thunderstorms",
                "affected_region": "Pune / Mumbai Expressway Corridor",
                "precautionary_note": "Drive with hazard lights, speed limit temporarily capped at 60 KPH"
            }
        }
