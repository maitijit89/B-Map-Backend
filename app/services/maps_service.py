import httpx
from app.core.config import settings
from typing import Dict

class MapsService:
    def __init__(self):
        self.api_key = settings.GOOGLE_PLACES_API_KEY # Uses same key
        self.project_id = "b-map"

    def _is_api_key_valid(self) -> bool:
        if not self.api_key:
            return False
        val = self.api_key.lower()
        return not (val.startswith("your_") or "mock" in val or val == "")

    async def create_tile_session(self, map_type: str = "roadmap"):
        if not self._is_api_key_valid():
            return {
                "session": "mock_tile_session_token_123456789",
                "expiry": "86400s",
                "tileWidth": 256,
                "tileHeight": 256,
                "imageFormat": "PNG"
            }

        url = f"https://tile.googleapis.com/v1/createSession?key={self.api_key}"
        body = {
            "mapType": map_type,
            "language": "en-US",
            "region": "US"
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=body)
                return response.json()
        except Exception as e:
            return {"error": str(e)}

    async def get_elevation(self, locations: str):
        if not self._is_api_key_valid():
            # mock elevation data based on locations
            results = []
            for loc in locations.split("|"):
                parts = loc.split(",")
                lat = float(parts[0]) if len(parts) > 0 else 37.42
                lng = float(parts[1]) if len(parts) > 1 else -122.08
                results.append({
                    "elevation": 10.5 + (lat - 37.0) * 100,
                    "location": {"lat": lat, "lng": lng},
                    "resolution": 9.5
                })
            return {"results": results, "status": "OK"}

        url = "https://maps.googleapis.com/maps/api/elevation/json"
        params = {
            "locations": locations,
            "key": self.api_key
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                return response.json()
        except Exception:
            return {"results": [], "status": "REQUEST_DENIED"}

    async def get_aerial_view(self, address: str):
        if not self._is_api_key_valid():
            return {
                "state": "COMPLETED",
                "video": {
                    "urls": {
                        "mp4": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                    }
                },
                "address": address
            }

        url = f"https://aerialview.googleapis.com/v1/videos:lookupVideo?key={self.api_key}&address={address}"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                return response.json()
        except Exception as e:
            return {"error": str(e)}

    def get_static_map_url(self, center: str, zoom: int = 14, size: str = "600x400") -> Dict[str, str]:
        key = self.api_key if self._is_api_key_valid() else "mock_key"
        url = f"https://maps.googleapis.com/maps/api/staticmap?center={center}&zoom={zoom}&size={size}&key={key}"
        return {"url": url, "is_mock": not self._is_api_key_valid()}

    def get_street_view_url(self, location: str, size: str = "600x400") -> Dict[str, str]:
        key = self.api_key if self._is_api_key_valid() else "mock_key"
        url = f"https://maps.googleapis.com/maps/api/streetview?location={location}&size={size}&key={key}"
        return {"url": url, "is_mock": not self._is_api_key_valid()}

    async def list_datasets(self):
        if not self._is_api_key_valid():
            return {
                "datasets": [
                    {
                        "name": f"projects/{self.project_id}/datasets/mock-dataset-1",
                        "displayName": "Mock Environmental Data",
                        "status": {"state": "STATE_ACTIVE"}
                    }
                ]
            }

        url = f"https://mapsplatformdatasets.googleapis.com/v1/projects/{self.project_id}/datasets?key={self.api_key}"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                return response.json()
        except Exception as e:
            return {"error": str(e)}

    async def create_dataset(self, display_name: str):
        if not self._is_api_key_valid():
            return {
                "name": f"projects/{self.project_id}/datasets/mock-dataset-new",
                "displayName": display_name,
                "status": {"state": "STATE_IMPORTING"}
            }

        url = f"https://mapsplatformdatasets.googleapis.com/v1/projects/{self.project_id}/datasets?key={self.api_key}"
        body = {"displayName": display_name}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=body)
                return response.json()
        except Exception as e:
            return {"error": str(e)}

    async def delete_dataset(self, dataset_id: str):
        if not self._is_api_key_valid():
            return {"status": "SUCCESS", "message": f"Dataset {dataset_id} deleted."}

        url = f"https://mapsplatformdatasets.googleapis.com/v1/projects/{self.project_id}/datasets/{dataset_id}?key={self.api_key}"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(url)
                return response.json()
        except Exception as e:
            return {"error": str(e)}
