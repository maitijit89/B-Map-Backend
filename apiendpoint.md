# 📡 B-Map Platform Complete REST API Reference

> **Exhaustive Endpoint Directory, Schemas, Request Payloads & Response Contracts**  
> *Base API URL:* `http://localhost:8080/api/v1` | *Protocol:* HTTP / HTTPS / WebSocket (Socket.IO)

---

## 1. Global Conventions & Headers

### Authentication Headers
Endpoints requiring authentication must supply the JWT Bearer token:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Common Rate Limiting Headers
```http
RateLimit-Limit: 15
RateLimit-Remaining: 14
RateLimit-Reset: 900
```

---

## 2. System Health & Diagnostics (`/health`)

### `GET /api/v1/health`
Checks overall platform health, MongoDB status, Redis cache state, memory usage, and uptime.
- **Access Level**: Public
- **Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "B-Map Navigation Backend API is healthy",
  "data": {
    "status": "UP",
    "timestamp": "2026-10-12T22:38:23.000Z",
    "uptimeSeconds": 1420,
    "version": "1.0.0",
    "environment": "development",
    "services": {
      "mongodb": { "status": "UP", "readyState": 1 },
      "redis": { "status": "UP", "connected": true },
      "osrm": { "status": "UP" }
    },
    "system": {
      "memoryUsageMb": { "heapUsed": 58.59, "rss": 112.4 }
    }
  }
}
```

---

## 3. Authentication & User Identity (`/auth`)

### `POST /api/v1/auth/signup`
Registers a new user with Name, Age, Email, and Phone Number. Dispatches a 6-digit email OTP.
- **Access Level**: Public (Rate-limited: 15 requests/15m)
- **Request Body**:
```json
{
  "name": "Aarav Sharma",
  "age": 26,
  "email": "aarav.sharma@example.com",
  "phoneNumber": "+919876543210"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Registration initiated successfully. Verification OTP has been sent to your email.",
  "data": {
    "email": "aarav.sharma@example.com",
    "name": "Aarav Sharma",
    "expiresInMinutes": 5
  }
}
```

### `POST /api/v1/auth/verify-registration-otp`
Validates the 6-digit registration OTP, activates the account, and returns a signed JWT access token.
- **Access Level**: Public (3 attempts maximum before lockout)
- **Request Body**:
```json
{
  "email": "aarav.sharma@example.com",
  "otp": "497511"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verified successfully! Welcome to B-Map.",
  "data": {
    "user": {
      "id": "670b16a2493f0b2f",
      "name": "Aarav Sharma",
      "age": 26,
      "email": "aarav.sharma@example.com",
      "phoneNumber": "+919876543210",
      "isEmailVerified": true,
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": "72h"
  }
}
```

### `POST /api/v1/auth/login`
Initiates passwordless login by dispatching an OTP to the user's verified email.
- **Access Level**: Public
- **Request Body**:
```json
{
  "email": "aarav.sharma@example.com"
}
```

### `POST /api/v1/auth/verify-login-otp`
Verifies login OTP and issues a fresh JWT session token.
- **Access Level**: Public
- **Request Body**:
```json
{
  "email": "aarav.sharma@example.com",
  "otp": "914506"
}
```

### `POST /api/v1/auth/resend-otp`
Requests a fresh OTP code subject to a mandatory 30-second cooldown window.
- **Request Body**:
```json
{
  "email": "aarav.sharma@example.com",
  "type": "registration"
}
```

### `GET /api/v1/auth/me`
Retrieves authenticated user session profile.
- **Access Level**: Authenticated User (`Bearer <token>`)

### `PUT /api/v1/auth/me`
Updates user profile information.
- **Request Body**:
```json
{
  "name": "Aarav V. Sharma",
  "age": 27,
  "phoneNumber": "+919876543210"
}
```

### `POST /api/v1/auth/logout`
Terminates the user's current session.
- **Access Level**: Authenticated User

---

## 4. Core Routing & Directions (`/routes`)

### `GET /api/v1/routes/directions`
Calculates optimal routes between origin and destination coordinates.
- **Access Level**: Public
- **Query Parameters**:
  - `origin` *(required)*: `lon,lat` (e.g., `77.1025,28.7041`)
  - `destination` *(required)*: `lon,lat` (e.g., `77.2090,28.6139`)
  - `profile` *(optional)*: `driving` | `bike` | `foot` (default: `driving`)
  - `alternatives` *(optional)*: `true` | `false` (default: `false`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "routes": [
      {
        "distanceMeters": 16420.5,
        "durationSeconds": 1380.2,
        "geometry": "c`nnDghsfMv@k@...",
        "legs": [
          {
            "distance": 16420.5,
            "duration": 1380.2,
            "steps": [
              {
                "maneuver": {
                  "type": "depart",
                  "location": [77.1025, 28.7041],
                  "instruction": "Head south toward Outer Ring Road"
                },
                "distance": 450.0,
                "duration": 42.0,
                "name": "Outer Ring Road"
              }
            ]
          }
        ]
      }
    ],
    "waypoints": [
      { "location": [77.1025, 28.7041], "name": "Pitampura" },
      { "location": [77.2090, 28.6139], "name": "Connaught Place" }
    ]
  }
}
```

### `POST /api/v1/routes/optimize-trip`
Solves the Traveling Salesperson Problem (TSP) across multiple waypoints.
- **Request Body**:
```json
{
  "coordinates": [
    [77.1025, 28.7041],
    [77.1200, 28.6800],
    [77.1850, 28.6300],
    [77.2090, 28.6139]
  ],
  "roundtrip": true,
  "source": "first",
  "destination": "last"
}
```

### `POST /api/v1/routes/match`
Snaps noisy raw GPS coordinate traces onto the actual road graph.
- **Request Body**:
```json
{
  "coordinates": [
    [77.1024, 28.7040],
    [77.1026, 28.7038],
    [77.1029, 28.7035]
  ],
  "timestamps": [1728770000, 1728770005, 1728770010]
}
```

---

## 5. Geospatial Places & POIs (`/places`)

### `GET /api/v1/places/nearby`
Finds points of interest near coordinates using MongoDB `2dsphere` `$near` operator.
- **Query Parameters**:
  - `longitude` *(required)*: e.g. `77.2090`
  - `latitude` *(required)*: e.g. `28.6139`
  - `maxDistance` *(optional)*: in meters (default: `5000`)
  - `category` *(optional)*: e.g. `fuel`, `hospital`, `restaurant`, `ev_charging`, `toll`
  - `limit` *(optional)*: default `20`
- **Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "plc_670b18f0",
      "name": "Indian Oil Petrol Pump & EV Fast Charger",
      "category": "fuel",
      "coordinates": [77.2150, 28.6180],
      "distanceMeters": 640.2,
      "rating": 4.6,
      "address": { "city": "New Delhi", "state": "Delhi" }
    }
  ]
}
```

### `GET /api/v1/places/search`
Text search across place names, descriptions, and tags (ReDoS protected).
- **Query Parameters**: `keyword=Apollo+Hospital&category=hospital`

---

## 6. Active Navigation Engine (`/navigation`)

### `POST /api/v1/navigation/start`
Initializes a new turn-by-turn navigation session.
- **Request Body**:
```json
{
  "origin": [77.1025, 28.7041],
  "destination": [77.2090, 28.6139],
  "profile": "driving",
  "vehicleType": "car"
}
```
- **Response**:
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "sessionId": "nav_sess_1791825000",
    "route": { ... },
    "socketRoom": "nav:nav_sess_1791825000",
    "offRouteThresholdMeters": 40
  }
}
```

### `POST /api/v1/navigation/update-location`
Streams vehicle position, computes cross-track error, updates HUD, and triggers automatic reroute if off-route.
- **Request Body**:
```json
{
  "sessionId": "nav_sess_1791825000",
  "currentLocation": [77.1080, 28.6990],
  "bearing": 185.4,
  "speedKmph": 48.2
}
```

---

## 7. Real-Time Tracking & Proximity (`/tracking`)

### `POST /api/v1/tracking/update`
Ingests driver position into Redis `GEOADD` and broadcasts to tracking rooms.
- **Request Body**:
```json
{
  "driverId": "drv_delhi_902",
  "longitude": 77.2100,
  "latitude": 28.6200,
  "status": "available",
  "vehicleType": "auto_rickshaw"
}
```

### `GET /api/v1/tracking/nearby`
Finds all active drivers within a radius using Redis `GEOSEARCH`.
- **Query Parameters**: `longitude=77.2100&latitude=28.6200&radiusKm=3`

---

## 8. Sovereign Indian GIS Modules

### 8.1 ISRO NavIC Dual-Band Processing (`/navic`)
- `POST /api/v1/navic/process`: Ingests dual-frequency L5/S-band raw measurements and applies ionospheric delay cancellation.
- `GET /api/v1/navic/status`: Returns NavIC constellation status and visible IRNSS satellite count (1A through 1I).

### 8.2 DigiPIN Hierarchical Grid Addressing (`/digipin`)
- `GET /api/v1/digipin/encode?lat=28.6139&lon=77.2090`: Generates a 10-character DigiPIN (e.g. `28J4-K8M2-9P`).
- `GET /api/v1/digipin/decode?digipin=28J4-K8M2-9P`: Resolves DigiPIN to bounding box polygon and center coordinates.

### 8.3 6-Digit Indian Postal Pincode (`/pincode`)
- `GET /api/v1/pincode/lookup?code=110001`: Returns Connaught Place post offices, district, and spatial boundary.
- `GET /api/v1/pincode/search?query=Gurugram`: Autocompletes PIN codes across Haryana.

### 8.4 NHAI FASTag Toll Plazas (`/tolls`)
- `GET /api/v1/tolls/calculate?origin=77.1025,28.7041&destination=75.8173,26.9124&vehicleClass=4`: Calculates total FASTag toll fees on Delhi-Jaipur highway.
- `GET /api/v1/tolls/plazas`: Lists calibrated National Highway toll plazas.

### 8.5 IMD Highway Weather Advisories (`/weather`)
- `GET /api/v1/weather/corridor?corridor=Yamuna+Expressway`: Retrieves current IMD winter fog/monsoon advisories.

### 8.6 Vernacular Direction TTS Localization (`/vernacular`)
- `POST /api/v1/vernacular/translate`: Translates turn-by-turn guidance strings into any of 12 Indian languages (`hi`, `ta`, `te`, `bn`, `mr`, `gu`, `kn`, `ml`, `pa`, `or`, `as`, `en`).

---

## 9. Next-Gen Automotive & Safety Modules

### 9.1 High-Definition Lane Routing (`/lane-routing`)
- `POST /api/v1/lane-routing/maneuver`: Returns multi-lane split recommendations for upcoming highway interchanges.

### 9.2 Spatial Reality (SR) Navigation (`/sr-navigation`)
- `GET /api/v1/sr-navigation/hud-elements`: Returns 3D vector points for Head-Up Display projection.

### 9.3 Rider Mode Two-Wheeler Routing (`/rider-mode`)
- `GET /api/v1/rider-mode/route`: Computes motorcycle-safe route, avoiding pedestrian bans and flyover weight restrictions.

### 9.4 Multilevel Indoor Parking (`/parking`)
- `GET /api/v1/parking/facility/:id`: Returns floor plans, available bays, and indoor navigation routes.

### 9.5 Connected Vehicle V2X (`/v2x`)
- `POST /api/v1/v2x/broadcast`: Broadcasts localized hazard alerts (emergency brake, obstacle) to vehicles within 500m.

---

## 10. AI Copilot & Spatial Data Mining

### 10.1 Natural Language Voice Copilot (`/ai-copilot`)
- `POST /api/v1/ai-copilot/query`: Accepts driver voice transcriptions and generates routing recommendations.

### 10.2 Spatial Data Mining (`/data-mining`)
- `GET /api/v1/data-mining/congestion`: Returns predicted congestion heatmaps for road segments.

---

## 11. Lifestyle, Super-App & Commercial Modules

### 11.1 Multimodal Public Transit (`/transit`)
- `GET /api/v1/transit/plan`: Generates multimodal journey plans combining Metro lines, feeder buses, and walking.

### 11.2 Augmented Reality Walking (`/ar-walk-cycle`)
- `GET /api/v1/ar-walk-cycle/path`: Returns pedestrian AR waypoints and safety crossings.

### 11.3 EV Charging Network (`/ev`)
- `GET /api/v1/ev/nearby`: Locates EV fast chargers filtered by connector type (`CCS2`, `Type2`, `GB/T`).

### 11.4 Emergency SOS Dispatch (`/emergency`)
- `POST /api/v1/emergency/sos`: Triggers emergency distress alert and notifies nearest highway patrol and ambulance units.

---

## 12. Administrative Control Center (`/admin`)

> **Note**: All administrative endpoints require `Authorization: Bearer <token>` where user has `role: admin`.

### `GET /api/v1/admin/dashboard`
Serves the self-contained, interactive glassmorphic web portal.

### `GET /api/v1/admin/overview`
Retrieves executive telemetry metrics: total users, verified counts, active alerts, average rating.

### `GET /api/v1/admin/system/health`
Detailed system diagnostics: database connections, memory allocation, and runtime environment.

### `GET /api/v1/admin/system/config`
Retrieves dynamic runtime flags (NavIC, Lane Guidance, AI Copilot, thresholds).

### `PATCH /api/v1/admin/system/config`
Dynamically mutates system parameters in real-time without server reload:
```json
{
  "maintenance_mode": false,
  "navic_enhancement_enabled": true,
  "ai_copilot_enabled": true,
  "lane_routing_enabled": true,
  "off_route_threshold_meters": 45,
  "reroute_cooldown_seconds": 6
}
```

### `GET /api/v1/admin/users`
Paginated search and filter across user directory:
- `limit=20&page=1&role=user&search=Sharma`

### `POST /api/v1/admin/traffic/override`
Injects manual traffic delay advisory on specific highway:
```json
{
  "corridor": "NH-48 Gurgaon-Manesar",
  "speedLimitKmph": 30,
  "severity": "CRITICAL",
  "reason": "Waterlogging under IFFCO Chowk flyover"
}
```

### `GET /api/v1/admin/audit-logs`
Fetches immutable cryptographic audit trail of all administrative events.
