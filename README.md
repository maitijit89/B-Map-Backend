# 🗺️ B-Map Backend: Production-Grade Navigation & Mapping Engine

High-performance, low-latency Go backend for **B-Map** (a full-scale Google Maps clone), featuring real-time turn-by-turn navigation, GPS map matching, dynamic off-route rerouting, dynamic Mapbox Vector Tile (MVT) generation, and real-time fleet telemetry.

---

## ⚡ Architecture & Tech Stack

- **Core Framework**: Go (Golang) + Gin Engine
- **Geospatial Database**: PostgreSQL 16 + PostGIS extension (`geometry(Point, 4326)`, `ST_DWithin`, `ST_AsMVT`, `ST_TileEnvelope`)
- **Spatial Caching & Real-Time**: Redis 7 (`GEOADD`, `GEOSEARCH`, Pub/Sub messaging)
- **Live Telemetry & Communication**: Gorilla WebSockets (sub-millisecond GPS streaming)
- **Pathfinding & Routing**: A* shortest path search, turn maneuver classifier, Google Polyline 5-decimal encoder
- **Containerization & CI/CD**: Docker (multi-stage minimal Alpine runner), Docker Compose, GitHub Actions

---

## 🚀 Quick Start with Docker

```bash
# 1. Prepare environment variables
cp .env.example .env

# 2. Build and launch stack (API + PostGIS + Redis)
docker-compose up --build -d

# 3. Check health status
curl http://localhost:8080/health
```

---

## 🧭 Production Navigation & Routing API

### 1. Turn-by-Turn Navigation Directions
* **Endpoint**: `GET /api/v1/routes/directions`
* **Query Parameters**:
  - `origin`: `lat,lng` (e.g., `37.7749,-122.4194`)
  - `destination`: `lat,lng` (e.g., `37.7833,-122.4167`)
  - `mode`: `driving` | `walking` | `bicycling`
  - `waypoints`: *(optional, pipe-separated `lat,lng|lat,lng`)*
* **Sample Request**:
```bash
curl "http://localhost:8080/api/v1/routes/directions?origin=37.7749,-122.4194&destination=37.7833,-122.4167&mode=driving"
```
* **Sample Response**:
```json
{
  "success": true,
  "route": {
    "summary": "1.2 km route",
    "distance_meters": 1248.5,
    "duration_seconds": 100,
    "overview_polyline": "u{~nFvyys@_@a@_@a@..._@?",
    "bounds": {
      "northeast": { "lat": 37.7833, "lng": -122.4167 },
      "southwest": { "lat": 37.7749, "lng": -122.4194 }
    },
    "steps": [
      {
        "instruction": "Head towards bearing 45°",
        "maneuver": "depart",
        "distance_meters": 200,
        "duration_seconds": 16
      },
      {
        "instruction": "Turn right, continue for 400 meters",
        "maneuver": "turn_right",
        "distance_meters": 400,
        "duration_seconds": 32
      },
      {
        "instruction": "You have arrived at your destination",
        "maneuver": "arrive",
        "distance_meters": 0,
        "duration_seconds": 0
      }
    ]
  }
}
```

---

### 2. Live GPS Map Matching & Auto-Rerouting
* **Endpoint**: `POST /api/v1/routes/progress`
* **Payload**:
```json
{
  "user_location": { "lat": 37.7760, "lng": -122.4180 },
  "route": { /* Active RouteResponse object */ },
  "mode": "driving",
  "off_route_threshold_meters": 30.0
}
```
* **Behavior**:
  - If user is within $30\text{m}$ of the route: Snaps coordinate to nearest road segment, returns remaining distance/duration and current step instruction.
  - If user is $> 30\text{m}$ off-route: Returns `rerouted: true` with a newly recalculated route starting from current location.

---

### 3. Dynamic Mapbox Vector Tile (MVT) Server
* **Endpoint**: `GET /api/v1/tiles/:z/:x/:y.mvt` (or `.pbf`)
* **Behavior**: Uses PostGIS `ST_TileEnvelope(z, x, y)` and `ST_AsMVT` to serve binary vector tiles on the fly directly to Mapbox GL JS / MapLibre.

---

### 4. Real-Time Fleet Telemetry & Live Vehicle Matching
* **Update Vehicle GPS Location**: `POST /api/v1/fleet/location`
* **Query Nearby Drivers (Redis GEO)**: `GET /api/v1/fleet/nearby-drivers?lat=37.7749&lng=-122.4194&radius=5000`
* **Request Trip / Ride**: `POST /api/v1/fleet/trips`
* **Accept Trip**: `POST /api/v1/fleet/trips/:id/accept`
* **WebSocket Live Telemetry Stream**: `ws://localhost:8080/api/v1/fleet/ws?client_id=<user_id>`

---

### 5. Places Engine (Search, Autocomplete & Reverse Geocode)
* **Spatial & Semantic Search**: `GET /api/v1/places/search?q=coffee&lat=37.7749&lng=-122.4194&radius=5000`
* **Typeahead Autocomplete**: `GET /api/v1/places/autocomplete?q=Blue&lat=37.7749&lng=-122.4194`
* **Reverse Geocode (Coordinate to Place)**: `GET /api/v1/places/reverse?lat=37.7749&lng=-122.4194`
* **Create POI**: `POST /api/v1/places` (Protected by Bearer JWT)

---

### 6. Authentication (Redis OTP + JWT)
* **Request OTP**: `POST /api/v1/auth/login`
* **Verify OTP & Issue JWT**: `POST /api/v1/auth/verify`
* **Current Profile**: `GET /api/v1/auth/me` (Protected by Bearer JWT)
