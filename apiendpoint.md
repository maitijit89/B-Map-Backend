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

---

## 25. Real-Time Traffic & Dynamic ETAs (`/traffic`)

### `POST /api/v1/traffic/telemetry`
Aggregates real-time, anonymized velocity vectors from active devices to determine average segment speed using harmonic mean and multi-device clustering.
- **Request Body**:
```json
{
  "vectors": [
    {
      "deviceId": "dev_client_82910",
      "coordinate": [77.0885, 28.4955],
      "speedKmh": 45.2,
      "headingDeg": 215,
      "accuracyMeters": 4.5,
      "vehicleType": "car"
    }
  ]
}
```

### `POST /api/v1/traffic/eta`
Calculates real-time traffic and turn-by-turn ETA weighted by travel time in **MINUTES (not kilometers)**. Models intersections as nodes and road segments as edges with dynamic congestion re-weighting.
- **Request Body**:
```json
{
  "origin": [77.2185, 28.6328],
  "destination": [77.0715, 28.4725],
  "departureTime": "2026-10-25T08:30:00.000Z"
}
```

### `POST /api/v1/traffic/evaluate-anomaly`
Evaluates multi-device clustering and outlier rejection to prevent false positives (like one scooter stopping at a roadside tea stall while other traffic flows freely).
- **Request Body**:
```json
{
  "candidate": {
    "deviceId": "scooter_rajesh_99",
    "coordinate": [77.0888, 28.4952],
    "speedKmh": 2.0,
    "headingDeg": 215,
    "vehicleType": "scooter"
  },
  "targetSegmentId": "SEG_CYBER_IFFCO_06"
}
```

### `GET /api/v1/traffic/graph`
Returns directed road graph topology: intersections as nodes (signal cycle wait times) and road segments as edges weighted in minutes.

### `GET /api/v1/traffic/segments`
Retrieves all road segments with live speeds, congestion levels (`free_flow`, `slow`, `congested`, `severe_gridlock`), and travel times in minutes.

### `GET /api/v1/traffic/predict?segmentId=SEG_CP_BARAKHAMBA_01&targetTime=2026-10-26T09:15:00.000Z`
Combines live telemetry with historical speed distributions across 15-minute time windows (96 buckets per day).

---

## 19. App Version Control & Dynamic Frontend Patching (`/app-version` & `/version`)

Authoritative sovereign release version is **`1.0.0`**. Provides client semantic version verification, phased rollouts, force-update governance, and dynamic frontend OTA delta bundle patching via API.

### `GET /api/v1/app-version/current`
Returns the authoritative running backend version.
- **Access Level**: Public
- **Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Current authoritative backend version retrieved",
  "data": {
    "appVersion": "1.0.0",
    "environment": "development",
    "service": "B-Map Sovereign Geospatial Platform",
    "timestamp": "2026-10-25T00:00:00.000Z"
  }
}
```

### `GET /api/v1/app-version/latest`
Returns latest active version specifications and patch releases across all supported platforms (`web`, `android`, `ios`, `desktop`).
- **Access Level**: Public

### `GET /api/v1/app-version/check?platform=web&version=1.0.0&buildNumber=100`
### `POST /api/v1/app-version/check`
Evaluates installed frontend or mobile app version against current server release. Informs the client whether an update is available, mandatory (`forceUpdate: true`), or if an OTA delta patch bundle can be hot-reloaded immediately.
- **Request Parameters / Body**:
```json
{
  "platform": "web",
  "version": "1.0.0",
  "buildNumber": 100
}
```
- **Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Frontend client is currently up to date",
  "data": {
    "updateAvailable": false,
    "forceUpdate": false,
    "currentVersion": "1.0.0",
    "installedVersion": "1.0.0",
    "latestBuildNumber": 100,
    "installedBuildNumber": 100,
    "downloadUrl": "https://bmap.io",
    "patchAvailable": false,
    "title": "B-Map Sovereign Platform v1.0.0 (WEB)",
    "releaseNotes": [
      "Version 1.0.0 Sovereign Release",
      "Real-time crowdsourced traffic & dynamic ETA calculation",
      "Kinematic Extended Kalman Filter (EKF) motion fusion",
      "LWR macroscopic traffic flow shockwave & spillback prediction",
      "Zero-trust cryptographic telematics signing and anti-spoofing guard"
    ],
    "isMaintenance": false
  }
}
```

### `PATCH /api/v1/app-version/patch`
**Dynamic Frontend Version Patch API**: Dynamically updates client release versions, force update rules, release notes, and OTA JavaScript/bundle hot-reload URLs via REST API. Automatically emits a real-time WebSocket broadcast (`app_version:update_available`) to all connected active frontends.
- **Access Level**: Admin / System
- **Request Body**:
```json
{
  "platform": "web",
  "currentVersion": "1.0.1",
  "minimumSupportedVersion": "1.0.0",
  "latestBuildNumber": 101,
  "title": "B-Map Web v1.0.1 Hotfix",
  "releaseNotes": [
    "Hotfix: Real-time traffic WebSocket reconnect stability",
    "Enhanced EKF sensor smoothing for subway exits",
    "DigiPIN 4m x 4m precision alignment update"
  ],
  "patchBundleUrl": "https://cdn.bmap.io/bundles/web/v1.0.1/main.bundle.js",
  "patchHash": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "patchSize": 492000,
  "forceUpdate": false,
  "broadcastSocket": true
}
```
- **Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Frontend web version successfully patched to v1.0.1",
  "data": {
    "platform": "web",
    "currentVersion": "1.0.1",
    "minimumSupportedVersion": "1.0.0",
    "latestBuildNumber": 101,
    "patchBundleUrl": "https://cdn.bmap.io/bundles/web/v1.0.1/main.bundle.js",
    "patchHash": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    "patchSize": 492000,
    "forceUpdate": false,
    "releasedAt": "2026-10-25T00:03:00.000Z",
    "updatedAt": "2026-10-25T00:03:00.000Z"
  }
}
```

### `POST /api/v1/app-version/broadcast`
Manually triggers a real-time Socket.IO version update push to all connected frontend clients.
- **Request Body**:
```json
{
  "platform": "web"
}
```

---

## 20. Sovereign Indian GIS Stack & Advanced Telematics (`/tolls`, `/weather`, `/obfuscation`, `/vernacular`, `/navic`, `/digipin`)

### 20.1 NHAI FASTag Dynamic Toll Engine (`/tolls`)
Calculates real-time electronic toll tariffs across National Expressways (Delhi-Mumbai NE-4, Yamuna Expressway, Eastern Peripheral NE-2, Bengaluru-Mysuru NH-275, etc.) segmented across Vehicle Classes 4 through 9, paired with cashless RFID and ANPR lane guidance.

#### `POST /api/v1/tolls/calculate`
Calculates cumulative tolls for a corridor or coordinate route path based on vehicle class.
- **Request Body**:
```json
{
  "routeCoordinates": [
    [77.0688, 28.2412],
    [76.9855, 28.1255]
  ],
  "vehicleClass": "CLASS_4",
  "expressway": "Delhi-Mumbai NE-4",
  "fastagActive": true
}
```
*Vehicle Class Options*: `CLASS_4` (Car/Jeep/Van, 1.0x), `CLASS_5` (Light Commercial Vehicle, 1.60x), `CLASS_6` (Bus/2-Axle Truck, 3.35x), `CLASS_7` (3-Axle Commercial, 3.65x), `CLASS_8` (4–6 Axle Heavy Truck, 5.25x), `CLASS_9` (7+ Axle Oversized Vehicle, 6.40x), `TWO_WHEELER_EXEMPT` (0 INR - Indian expressways toll-exempt for 2-wheelers).
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dynamic FASTag tolls calculated successfully",
  "data": {
    "totalTollFee": 490,
    "currency": "INR",
    "vehicleClass": "CLASS_4",
    "tollPlazasCount": 2,
    "plazasEnRoute": [
      {
        "id": "toll_sohna_ne4",
        "name": "Sohna KM 11 Toll Plaza",
        "highway": "Delhi-Mumbai Expressway (NE-4)",
        "baseTariff": 90,
        "calculatedTariff": 90,
        "cashlessGuidance": {
          "fastagOnlyLanes": [1, 2, 3, 4, 6, 7, 8],
          "cashPenaltyMultiplier": 2.0,
          "anprBoomBarrierEnabled": true,
          "recommendedLane": 3
        }
      },
      {
        "id": "toll_bhandarej_ne4",
        "name": "Bhandarej Interchange Toll Plaza",
        "highway": "Delhi-Mumbai Expressway (NE-4)",
        "baseTariff": 400,
        "calculatedTariff": 400,
        "cashlessGuidance": {
          "fastagOnlyLanes": [1, 2, 3, 5, 6, 7],
          "cashPenaltyMultiplier": 2.0,
          "anprBoomBarrierEnabled": true,
          "recommendedLane": 2
        }
      }
    ]
  }
}
```

#### `GET /api/v1/tolls/nearby?lon=77.0688&lat=28.2412&radiusMeters=25000`
Locates nearby NHAI FASTag toll plazas within a radial distance.

---

### 20.2 IMD Severe Highway Weather Engine (`/weather`)
Ingests India Meteorological Department (IMD) colour-coded highway alerts (`GREEN`, `YELLOW`, `ORANGE`, `RED`) to reroute around northern winter zero-visibility fog (<50m) and monsoon flooding.

#### `GET /api/v1/weather/highway?highway=Delhi-Mumbai Expressway (NE-4)&lon=77.06&lat=28.24`
Returns real-time weather advisories, visibility distance, and reroute recommendations for highway corridors.
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Highway weather conditions retrieved",
  "data": {
    "highway": "Delhi-Mumbai Expressway (NE-4)",
    "alertLevel": "RED",
    "condition": "ZERO_VISIBILITY_FOG",
    "visibilityMeters": 35,
    "denseFogActive": true,
    "floodWarning": false,
    "speedReductionPercent": 60,
    "safeSpeedLimitKmh": 40,
    "isRerouteRecommended": true,
    "rerouteReason": "ZERO_VISIBILITY_WINTER_FOG",
    "advisory": "IMD Red Alert: Zero-visibility dense fog (<50m) reported. Proactive alternate route recommended."
  }
}
```

#### `POST /api/v1/weather/override`
Admin or automated meteorological feed override for emergency highway weather alerts.

---

### 20.3 Defense Area Polygon Obfuscation (`/obfuscation`)
Enforces the National Geospatial Policy by applying 200m–500m spatial coordinate jitter and polygon masking over sensitive defense installations and strategic facilities.

#### `POST /api/v1/obfuscation/defense-mask`
Applies defense zone checks and differential privacy masking to a coordinate or array of coordinates.
- **Request Body**:
```json
{
  "coordinate": [76.8175, 30.3705]
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Coordinate defense assessment completed",
  "data": {
    "isInsideDefenseZone": true,
    "zoneName": "Ambala Air Force Base Restricted Zone",
    "maskedCoordinate": [76.8198, 30.3729],
    "jitterDistanceMeters": 310.4,
    "compliance": "National Geospatial Policy 2022 - Section 7 Spatial Masking Mandate"
  }
}
```

#### `GET /api/v1/obfuscation/defense-zones`
Returns the GeoJSON polygon boundary index of sensitive strategic installations.

---

### 20.4 12-Language Vernacular Voice Synthesis (`/vernacular`)
Delivers localized turn-by-turn voice prompts and Text-to-Speech (TTS) strings across 12 scheduled Indian languages: Hindi (`hi`), Tamil (`ta`), Telugu (`te`), Bengali (`bn`), Marathi (`mr`), Gujarati (`gu`), Kannada (`kn`), Malayalam (`ml`), Punjabi (`pa`), Odia (`or`), Assamese (`as`), and English (`en`).

#### `POST /api/v1/vernacular/prompt`
Translates and formats navigation instructions into target vernacular language with phonetic cues.
- **Request Body**:
```json
{
  "language": "or",
  "maneuver": "turn-left",
  "distanceMeters": 300,
  "streetName": "Janpath Road"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Localized vernacular navigation prompt generated",
  "data": {
    "language": "or",
    "languageCode": "or-IN",
    "languageName": "Odia",
    "localizedPrompt": "300 meters pare Janpath Road re bama ku bulantu",
    "phoneticHint": "300 meters pare Janpath Road re bama ku bulantu",
    "ttsVoiceEngine": "hi-IN-Neural2-F",
    "audioFormat": "audio/mp3"
  }
}
```

#### `GET /api/v1/vernacular/languages`
Lists all 12 supported sovereign Indian vernacular languages with metadata and dialect support.

---

### 20.5 ISRO NavIC Dual-Frequency & GAGAN (`/navic`)
Ingests dual-frequency L5 (1176.45 MHz) and S-band (2492.028 MHz) pseudorange observations alongside GAGAN SBAS augmentation to eliminate equatorial ionospheric delays, achieving sub-meter horizontal precision across India and 1,500 km beyond national borders.

#### `POST /api/v1/navic/fix`
Processes raw multi-constellation satellite observables (NavIC L5/S, GPS L1, GAGAN).
- **Request Body**:
```json
{
  "pseudoranges": {
    "l5Meters": 21845120.4,
    "sBandMeters": 21845112.1
  },
  "satellitesVisible": 8,
  "hdop": 0.85,
  "rawCoordinate": [77.2185, 28.6328]
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "NavIC ionospheric dual-frequency correction applied",
  "data": {
    "correctedCoordinate": [77.2185012, 28.6328019],
    "horizontalAccuracyMeters": 0.85,
    "ionosphericDelayCancelledMeters": 8.3,
    "coverageZone": "INDIAN_MAINLAND_PRIMARY",
    "gaganAugmented": true
  }
}
```

---

### 20.6 DigiPIN 4m×4m Hierarchical Addressing (`/digipin`)
Encodes geographic coordinates into India's Department of Posts 10-character deterministic digital address (`XX-XX-XX-XX-XX`) accurate to a 4m×4m micro-grid, strictly using unambiguous characters `2-9` and consonants (excluding `0, 1, O, I`).

#### `GET /api/v1/digipin/encode?lon=77.2185&lat=28.6328`
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "DigiPIN generated successfully",
  "data": {
    "digipin": "HM-X6-TZ-RN-3H",
    "gridResolutionMeters": 4.0,
    "coordinate": [77.2185, 28.6328],
    "boundingPolygon": [
      [77.21848, 28.63278],
      [77.21852, 28.63278],
      [77.21852, 28.63282],
      [77.21848, 28.63282],
      [77.21848, 28.63278]
    ]
  }
}
```

#### `GET /api/v1/digipin/decode/HM-X6-TZ-RN-3H`
Decodes a 10-character DigiPIN back into its geographic centroid and 4m×4m bounding polygon.

---

### 20.7 Shockwave, Eco-Routing & Spatial Proof-of-Presence (`/traffic`)

#### `GET /api/v1/traffic/shockwave/:segmentId`
Computes macroscopic LWR shockwave propagation velocity ($w = \Delta q / \Delta k$), shockwave direction (`BACKWARD_FORMING` vs `FORWARD_RECOVERING`), and exact spillback minutes until upstream junctions block.

#### `POST /api/v1/traffic/eco`
Evaluates multi-criteria physics-based energy consumption across Petrol ICE ($\eta = 0.30$), Diesel ICE ($\eta = 0.34$), and EV ($\eta = 0.88$ with 70% regenerative braking recovery credit).

#### `POST /api/v1/traffic/security/proof-of-presence`
Generates an authenticated, tamper-proof Proof-of-Presence certificate with a cryptographic HMAC-SHA256 signature for verified geofence entry and automated toll/valet gate access.

---

## 21. Real-Time Telematics Gateway & Kubernetes Probes

### 21.1 Sub-50ms Kubernetes HPA Probes (`/health`)
Designed for high-frequency Kubernetes readiness and liveness checks (HPA) without waiting for upstream network timeouts:
- **`GET /api/v1/health?probe=true`** (or Header `x-k8s-probe: true`)
- **Latency Guarantee**: Returns within `< 50ms` (typically `1-2ms`).
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Kubernetes fast-path probe healthy",
  "data": {
    "status": "UP",
    "timestamp": "2026-10-25T01:38:25.000Z",
    "uptimeSeconds": 1420,
    "version": "1.0.0",
    "k8sProbe": true,
    "environment": "development"
  }
}
```

### 21.2 Socket.IO Real-Time Telematics Gateway (10 Event Domains)

| Socket.IO Event Domain | Core Bidirectional Event Channels | Room Scoping & Target Consumer |
| :--- | :--- | :--- |
| **1. Live Driver Tracking** | `location:update`, `location:broadcast`, `location:subscribe` | Room `driver:<driverId>` (1Hz–5Hz fleet & ride tracking) |
| **2. Active Turn-by-Turn Nav** | `nav:join`, `nav:update_progress`, `nav:off_route_alert`, `nav:reroute_success` | Room `nav:<sessionId>` (Instant off-route geometry push) |
| **3. Weak-Signal Positioning** | `positioning:telemetry`, `positioning:fused_state` | EKF tunnel dead reckoning & urban canyon state sync |
| **4. HD Lane Guidance** | `lane:guidance_stream`, `lane:guidance_broadcast`, `veteran:hazard_alert` | Multi-lane highway exit & lane-drift alerts |
| **5. SR Mixed Reality HUD** | `sr:telemetry_stream`, `sr:hud_broadcast`, `sr:collision_warning` | Spatial Reality windshield HUD & ADAS alerts |
| **6. Automotive CAN & IVI** | `auto:can_stream`, `auto:cockpit_sync`, `auto:eco_score_broadcast` | Room `auto:<vehicleId>` (CarPlay / Android Auto & OBD powertrain telemetry) |
| **7. Rider Mode Two-Wheeler** | `rider:dynamics_stream`, `rider:lean_broadcast`, `rider:crash_alert` | Room `rider:<sessionId>` (Two-wheeler lean angle & SOS crash detection) |
| **8. Indoor Bay Parking** | `parking:entrance_detect`, `parking:indoor_guidance`, `parking:bay_status` | Room `parking:<facilityId>` (BLE beacon gate handoff & live slot occupancy) |
| **9. AI Voice Copilot (Gemma)** | `copilot:message_stream`, `copilot:processing_status`, `copilot:message_response` | Streaming natural language voice intent & TTS replies |
| **10. Traffic & LWR Shockwave** | `traffic:telemetry_stream`, `traffic:segment_update`, `traffic:eta_update`, `traffic:anomaly_filtered` | Room `segment:<segmentId>` (Live BPR speeds & spillback warnings) |

