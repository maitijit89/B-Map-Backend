import math
from typing import Tuple, Dict, Any, List

class MapTileEngine:
    """
    Core Map Tile Engine: Converts lat/lng coordinates to Slippy Map Tile (x, y, z) indices and QuadKeys.
    Calculates viewport bounding boxes and clips spatial data for rendering engines.
    """
    @staticmethod
    def latlng_to_tile(lat: float, lng: float, zoom: int) -> Tuple[int, int]:
        """
        Converts (lat, lng, zoom) to tile (x, y) coordinates.
        """
        n = 2.0 ** zoom
        lat_rad = math.radians(lat)
        x_tile = int((lng + 180.0) / 360.0 * n)
        y_tile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
        return x_tile, y_tile

    @staticmethod
    def tile_to_latlng_bbox(x: int, y: int, zoom: int) -> Dict[str, float]:
        """
        Converts tile (x, y, zoom) to bounding box coordinates (min_lat, min_lng, max_lat, max_lng).
        """
        n = 2.0 ** zoom
        min_lng = (x / n) * 360.0 - 180.0
        max_lng = ((x + 1) / n) * 360.0 - 180.0

        min_lat_rad = math.atan(math.sinh(math.pi * (1.0 - 2.0 * (y + 1) / n)))
        max_lat_rad = math.atan(math.sinh(math.pi * (1.0 - 2.0 * y / n)))

        return {
            "min_lat": math.degrees(min_lat_rad),
            "min_lng": min_lng,
            "max_lat": math.degrees(max_lat_rad),
            "max_lng": max_lng
        }

    @staticmethod
    def tile_to_quadkey(x: int, y: int, zoom: int) -> str:
        """
        Converts tile (x, y, zoom) to Bing/Microsoft QuadKey string.
        """
        quadkey = []
        for i in range(zoom, 0, -1):
            digit = 0
            mask = 1 << (i - 1)
            if (x & mask) != 0:
                digit += 1
            if (y & mask) != 0:
                digit += 2
            quadkey.append(str(digit))
        return "".join(quadkey)

    def render_tile_metadata(self, x: int, y: int, zoom: int) -> Dict[str, Any]:
        bbox = self.tile_to_latlng_bbox(x, y, zoom)
        quadkey = self.tile_to_quadkey(x, y, zoom)
        return {
            "tile_x": x,
            "tile_y": y,
            "zoom": zoom,
            "quadkey": quadkey,
            "bounding_box": bbox,
            "tile_format": "PNG",
            "tile_size_px": 256,
            "vector_layers": ["roads", "buildings", "water", "transit", "poi"]
        }
