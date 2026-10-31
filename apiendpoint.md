# 📡 B-Map Platform Complete REST & Real-Time API Reference

> **Authoritative Endpoint Directory, Schemas, Request Payloads, Response Contracts & WebSocket Specifications**  
> *Base API URL:* `http://localhost:8080/api/v1` | *Protocol:* HTTP/1.1, HTTP/2 (with Gzip/Deflate) & WebSocket (Socket.IO v4)  
> *Sovereign Version:* `1.0.0` | *Environment:* Development & Production

---

## 📑 Directory of API Modules

1. [Global Conventions, Headers & Standard Response Envelope](#1-global-conventions-headers--standard-response-envelope)
2. [System Health Diagnostics & Sub-50ms Kubernetes Probes (`/health`)](#2-system-health-diagnostics--sub-50ms-kubernetes-probes-health)
3. [Authentication, User Identity & Passwordless OTP (`/auth`)](#3-authentication-user-identity--passwordless-otp-auth)
4. [High-Throughput Telemetry Ingestion, Fraud Detection & Async Queue (`/telemetry` & `/telemetry-ingest`)](#4-high-throughput-telemetry-ingestion-fraud-detection--async-queue-telemetry--telemetry-ingest)
5. [Real-Time Crowdsourced Traffic, Dynamic ETAs & Anomaly Suppression (`/traffic`)](#5-real-time-crowdsourced-traffic-dynamic-etas--anomaly-suppression-traffic)
6. [App Version Governance & Dynamic Frontend OTA Patching (`/app-version` & `/version`)](#6-app-version-governance--dynamic-frontend-ota-patching-app-version--version)
7. [Core Routing Engine, Directions & TSP Multi-Stop Optimization (`/routes`)](#7-core-routing-engine-directions--tsp-multi-stop-optimization-routes)
8. [Geospatial Places & POI Proximity Search (`/places`)](#8-geospatial-places--poi-proximity-search-places)
9. [Active Navigation Sessions & Sub-Second Dynamic Rerouting (`/navigation`)](#9-active-navigation-sessions--sub-second-dynamic-rerouting-navigation)
10. [Live Vehicle & Driver Tracking Primitives (`/tracking`)](#10-live-vehicle--driver-tracking-primitives-tracking)
11. [Location Access, Ephemeral Tokenization & Permissions (`/location` & `/location-access`)](#11-location-access-ephemeral-tokenization--permissions-location--location-access)
12. [Motion, Physical Fitness & Stationary Detection (`/motion` & `/motion-fitness`)](#12-motion-physical-fitness--stationary-detection-motion--motion-fitness)
13. [Targeted Notifications, APNS/FCM & Spatial Geofencing (`/notifications`)](#13-targeted-notifications-apnsfcm--spatial-geofencing-notifications)
14. [Nearby Peripherals, Bluetooth & Indoor BLE Beacon Registry (`/nearby-devices` & `/bluetooth`)](#14-nearby-peripherals-bluetooth--indoor-ble-beacon-registry-nearby-devices--bluetooth)
15. [High-Precision Positioning, RTK Decimeter & Weak-Signal Fusion (`/positioning`)](#15-high-precision-positioning-rtk-decimeter--weak-signal-fusion-positioning)
16. [HD Lane-Level Routing & "Veteran Driver" Layering (`/lane-routing`)](#16-hd-lane-level-routing--veteran-driver-layering-lane-routing)
17. [Spatial Reality (SR) HUD Navigation & 3D Junction Cards (`/sr-navigation`)](#17-spatial-reality-sr-hud-navigation--3d-junction-cards-sr-navigation)
18. [Automotive IVI, CAN-Bus & Apple CarPlay / Android Auto (`/automotive`)](#18-automotive-ivi-can-bus--apple-carplay--android-auto-automotive)
19. [Rider Mode Motorcycle Dynamics & e-Call Crash Detection (`/rider-mode`)](#19-rider-mode-motorcycle-dynamics--e-call-crash-detection-rider-mode)
20. [Multilevel Space-Level Indoor Parking Navigation (`/parking`)](#20-multilevel-space-level-indoor-parking-navigation-parking)
21. [Multi-Mode: Intelligent Car Navigation & Speed Radars (`/car-nav` & `/car-navigation`)](#21-multi-mode-intelligent-car-navigation--speed-radars-car-nav--car-navigation)
22. [Multi-Mode: Multimodal Public Transit Mastery (`/transit` & `/public-transit`)](#22-multi-mode-multimodal-public-transit-mastery-transit--public-transit)
23. [Multi-Mode: Augmented Reality (AR) Walk & Cycle Navigation (`/ar-walk-cycle`)](#23-multi-mode-augmented-reality-ar-walk--cycle-navigation-ar-walk-cycle)
24. [Conversational AI Voice Copilot & Gemma LLM Engine (`/ai-copilot`)](#24-conversational-ai-voice-copilot--gemma-llm-engine-ai-copilot)
25. [AI-Powered Data Production & Big-Data Trajectory Mining (`/data-mining` & `/ai-data-mining`)](#25-ai-powered-data-production--big-data-trajectory-mining-data-mining--ai-data-mining)
26. [Unified Underlying Navigation Lifecycle Engine (`/unified` & `/unified-engine`)](#26-unified-underlying-navigation-lifecycle-engine-unified--unified-engine)
27. [4D Dynamic Space Rendering, 3D Digital Twins & 360° Street View (`/spatial-vis` & `/spatial-visualization`)](#27-4d-dynamic-space-rendering-3d-digital-twins--360-street-view-spatial-vis--spatial-visualization)
28. [Unified Lifestyle & Commercial Super-App Ecosystem (`/super-app`)](#28-unified-lifestyle--commercial-super-app-ecosystem-super-app)
29. [Sovereign Indian GIS: ISRO NavIC Dual-Band Processing (`/navic`)](#29-sovereign-indian-gis-isro-navic-dual-band-processing-navic)
30. [Sovereign Indian GIS: NHAI FASTag Electronic Toll Tariffs (`/tolls`)](#30-sovereign-indian-gis-nhai-fastag-electronic-toll-tariffs-tolls)
31. [Sovereign Indian GIS: 6-Digit Department of Posts PINcode Registry (`/pincode`)](#31-sovereign-indian-gis-6-digit-department-of-posts-pincode-registry-pincode)
32. [Sovereign Indian GIS: 4m×4m National DigiPIN Micro-Grid Addressing (`/digipin`)](#32-sovereign-indian-gis-4m4m-national-digipin-micro-grid-addressing-digipin)
33. [Sovereign Indian GIS: Emergency SOS & Highway Trauma Dispatch (`/emergency`)](#33-sovereign-indian-gis-emergency-sos--highway-trauma-dispatch-emergency)
34. [Sovereign Indian GIS: IMD Severe Highway Weather & Fog Advisories (`/weather`)](#34-sovereign-indian-gis-imd-severe-highway-weather--fog-advisories-weather)
35. [Sovereign Indian GIS: 12-Language Vernacular Audio Synthesis (`/vernacular`)](#35-sovereign-indian-gis-12-language-vernacular-audio-synthesis-vernacular)
36. [Connected Vehicle V2X, SPaT & GLOSA Green Wave Advisory (`/v2x`)](#36-connected-vehicle-v2x-spat--glosa-green-wave-advisory-v2x)
37. [Environmental Intelligence: CPCB AQI, Rooftop Solar & Pollen (`/environment`)](#37-environmental-intelligence-cpcb-aqi-rooftop-solar--pollen-environment)
38. [Crowdsourced Road Hazards, Potholes & Speed Breakers (`/hazards`)](#38-crowdsourced-road-hazards-potholes--speed-breakers-hazards)
39. [Differential Privacy & Defense Installation Obfuscation (`/obfuscation`)](#39-differential-privacy--defense-installation-obfuscation-obfuscation)
40. [Survey of India (SOI) Territorial Boundaries & Masking (`/boundaries`)](#40-survey-of-india-soi-territorial-boundaries--masking-boundaries)
41. [Electric Vehicle (EV) Fast Charging Hubs (`/ev` & `/evcharging`)](#41-electric-vehicle-ev-fast-charging-hubs-ev--evcharging)
42. [Municipal City Metered Fares (`/fares`)](#42-municipal-city-metered-fares-fares)
43. [Roads Geometry Snapping & Speed Limits (`/roads`)](#43-roads-geometry-snapping--speed-limits-roads)
44. [Dynamic Vector Tiles & MapLibre Vector Styles (`/maps`, `/tiles`, `/maps-tiles`)](#44-dynamic-vector-tiles--maplibre-vector-styles-maps-tiles-maps-tiles)
45. [Commercial Fleet Telemetry & Dispatch (`/fleet`)](#45-commercial-fleet-telemetry--dispatch-fleet)
46. [Coordinate-to-Timezone Resolution (`/timezone`)](#46-coordinate-to-timezone-resolution-timezone)
47. [User Ratings, Feedback & Community Reviews (`/ratings`)](#47-user-ratings-feedback--community-reviews-ratings)
48. [Enterprise Admin Command Center & Control Portal (`/admin`)](#48-enterprise-admin-command-center--control-portal-admin)
49. [Socket.IO Real-Time Telematics Gateway: 10 Event Domains](#49-socketio-real-time-telematics-gateway-10-event-domains)

---

## 1. Global Conventions, Headers & Standard Response Envelope

### 1.1 Base URL & Content Negotiation
- **Base Endpoint**: `http://localhost:8080/api/v1`
- **Media Type**: `application/json`
- **Compression**: Payloads support **Gzip / Deflate** decompression via HTTP header `Content-Encoding: gzip` with body payload limits up to **10MB**.

### 1.2 Authentication & Security Headers
All protected resources require a valid JSON Web Token (JWT) signed with HMAC-SHA256:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

Common Rate Limiting Response Headers:
```http
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 900
```

### 1.3 Standardized API Response Envelopes

#### Success Envelope (2xx)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation completed successfully",
  "data": { ... },
  "meta": {
    "total": 120,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

#### Error Envelope (4xx / 5xx)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed on input parameters",
  "errors": [
    {
      "field": "coordinates",
      "message": "Must be valid [longitude, latitude] GeoJSON pair"
    }
  ]
}
```

---

## 2. System Health Diagnostics & Sub-50ms Kubernetes Probes (`/health`)

### `GET /api/v1/health`
Performs deep end-to-end health verification checking MongoDB connection state, Redis connectivity, OSRM upstream routing engine, system memory, and uptime.
- **Access Level**: Public
- **Query Parameters**:
  - `probe`: `boolean` (Optional). When `true`, activates the sub-50ms fast-path probe.
- **Headers**:
  - `x-k8s-probe`: `boolean` (Optional). Header-based fast-path trigger for Kubernetes HPA probes.
- **Response (200 OK - Standard Mode)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "B-Map Navigation Backend API is healthy",
  "data": {
    "status": "UP",
    "timestamp": "2026-10-31T06:00:00.000Z",
    "uptimeSeconds": 1420,
    "version": "1.0.0",
    "environment": "production",
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
- **Response (200 OK - Sub-50ms Kubernetes Probe Mode: `?probe=true`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Kubernetes fast-path probe healthy",
  "data": {
    "status": "UP",
    "timestamp": "2026-10-31T06:00:00.000Z",
    "uptimeSeconds": 1420,
    "version": "1.0.0",
    "k8sProbe": true,
    "environment": "production"
  }
}
```

---

## 3. Authentication, User Identity & Passwordless OTP (`/auth`)

Passwordless cryptographic identity flow verified via 6-digit email OTPs, expiring in 5 minutes with a 30-second resend cooldown.

### `POST /api/v1/auth/signup` (Alias: `POST /api/v1/auth/register`)
Registers a new user and dispatches a 6-digit registration OTP to the supplied email.
- **Access Level**: Public (Rate-limited: 15 requests / 15 minutes)
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

### `POST /api/v1/auth/verify-registration-otp` (Alias: `POST /api/v1/auth/verify-email`)
Verifies the 6-digit registration OTP, activates the account, and issues a 72-hour JWT Bearer token.
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

### `POST /api/v1/auth/login` (Alias: `POST /api/v1/auth/request-login-otp`)
Initiates passwordless login by dispatching an OTP to the user's verified email.
- **Request Body**:
```json
{
  "email": "aarav.sharma@example.com"
}
```

### `POST /api/v1/auth/verify-login-otp` (Alias: `POST /api/v1/auth/login/verify`)
Verifies the login OTP and returns a fresh JWT access token.
- **Request Body**:
```json
{
  "email": "aarav.sharma@example.com",
  "otp": "914506"
}
```

### `POST /api/v1/auth/resend-otp`
Re-sends an OTP code. Subject to an enforced 30-second cooldown period between attempts.
- **Request Body**:
```json
{
  "email": "aarav.sharma@example.com",
  "type": "registration"
}
```

### `GET /api/v1/auth/me`
Retrieves the profile of the currently authenticated user.
- **Headers**: `Authorization: Bearer <token>`

### `PUT /api/v1/auth/me`
Updates editable user profile fields (`name`, `age`, `phoneNumber`).
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "name": "Aarav V. Sharma",
  "age": 27
}
```

### `POST /api/v1/auth/logout`
Blacklists the current JWT session in Redis until token expiration.

---

## 4. High-Throughput Telemetry Ingestion, Fraud Detection & Async Queue (`/telemetry` & `/telemetry-ingest`)

Enterprise-grade telematics ingestion capable of accepting high-frequency raw hardware, IMU, battery, and location signals. Decoupled from the database via an asynchronous in-memory worker queue, automated emulator/fraud scoring heuristics, client-side idempotency, and Gzip compression.

### 4.1 Ingestion Architecture & Endpoints

| Endpoint | Method | Purpose & Processing Model | Status Codes |
| :--- | :--- | :--- | :--- |
| `/api/v1/telemetry/ingest` | `POST` | **Unified Ingestion**: Accepts single event, flat array, or batch envelope. | `202 Accepted` / `200 OK` / `400` |
| `/api/v1/telemetry/batch` | `POST` | **Mobile Buffered Batch**: Flushed every 30-60s or on app background transition. | `202 Accepted` / `200 OK` / `400` |
| `/api/v1/telemetry/heartbeat` | `POST` | **Lightweight Heartbeat**: Periodic keepalive signal (e.g., 60-second intervals). | `202 Accepted` / `200 OK` / `400` |
| `/api/v1/telemetry/stats` | `GET` | **Operational Telemetry Stats**: Queue depth, consumer throughput, fraud rate, open/stop rate. | `200 OK` |
| `/api/v1/telemetry/logs` | `GET` | **Query Stored Logs**: Paginated telemetry history with multi-attribute filtering. | `200 OK` / `400` |

### 4.2 `POST /api/v1/telemetry/ingest` (Unified Ingestion)
Accepts telemetry events, parses ~120 dynamic hardware/sensor metrics with Zod schema validation, evaluates batch- and event-level idempotency, and immediately returns **HTTP 202 Accepted** without database bottleneck.
- **Headers**:
  - `x-idempotency-key`: `string` (Optional, 8-128 chars).
  - `Content-Encoding`: `gzip` (Optional). When supplied, Express decompressor automatically inflates the binary body.
  - `x-client-platform`: `ios` | `android` | `web` | `automotive` | `iot`
- **Request Body (Single Event Example)**:
```json
{
  "eventId": "evt_90f2ab87_6782_4fbb_a331",
  "deviceId": "device_pixel8_pro_9918",
  "sessionId": "sess_nav_1793197700_delhi",
  "eventType": "heartbeat",
  "platform": "android",
  "appVersion": "2.4.0",
  "timestamp": 1793197706738,
  "clientTimezone": "Asia/Kolkata",
  "sessionStartTime": 1793197406738,
  "appState": "active",
  "metrics": {
    "batteryLevel": 84.5,
    "batteryState": "unplugged",
    "isCharging": false,
    "batteryTemperature": 31.2,
    "batteryVoltage": 4120,
    "batteryHealth": "good",
    "accelerometerX": 0.12,
    "accelerometerY": 9.78,
    "accelerometerZ": 0.45,
    "gyroscopeX": 0.01,
    "gyroscopeY": 0.02,
    "gyroscopeZ": -0.01,
    "latitude": 28.6139,
    "longitude": 77.2090,
    "altitude": 216.5,
    "speed": 12.5,
    "heading": 88.4,
    "horizontalAccuracy": 3.2,
    "satelliteCount": 11,
    "hdop": 0.85,
    "screenBrightness": 0.65,
    "cpuUsagePercent": 28.4,
    "networkType": "cellular",
    "cellularGeneration": "5g",
    "carrierName": "Jio 5G",
    "signalStrengthDbm": -78,
    "ambientLightLux": 340,
    "proximityDistanceCm": 5.0,
    "deviceModel": "Pixel 8 Pro",
    "osVersion": "Android 14",
    "isEmulator": false,
    "isMockLocation": false
  }
}
```
- **Response (202 Accepted - New Signal Queued for Async Processing)**:
```json
{
  "status": "queued",
  "eventId": "evt_90f2ab87_6782_4fbb_a331",
  "queuedCount": 1,
  "duplicateCount": 0,
  "timestamp": "2026-10-31T06:05:00.000Z"
}
```
- **Response (200 OK - Duplicate Signal Ignored via Idempotency)**:
```json
{
  "status": "already_processed",
  "queuedCount": 0,
  "duplicateCount": 1,
  "timestamp": "2026-10-31T06:05:02.000Z"
}
```

### 4.3 `POST /api/v1/telemetry/batch` (Buffered Mobile Batch)
Recommended client integration pattern: mobile apps buffer events in SQLite/Room/CoreData and flush every 30-60 seconds in a single compressed batch envelope.
- **Request Body**:
```json
{
  "batchId": "batch_mob_1793197706738_8921",
  "deviceId": "device_pixel8_pro_9918",
  "platform": "android",
  "appVersion": "2.4.0",
  "clientTimezone": "Asia/Kolkata",
  "events": [
    {
      "eventId": "evt_batch_01_1793197706738",
      "deviceId": "device_pixel8_pro_9918",
      "sessionId": "sess_nav_1793197700_delhi",
      "eventType": "telematics",
      "platform": "android",
      "appVersion": "2.4.0",
      "timestamp": 1793197650000,
      "clientTimezone": "Asia/Kolkata",
      "metrics": {
        "speed": 14.2,
        "batteryLevel": 85.0
      }
    },
    {
      "eventId": "evt_batch_02_1793197706738",
      "deviceId": "device_pixel8_pro_9918",
      "sessionId": "sess_nav_1793197700_delhi",
      "eventType": "heartbeat",
      "platform": "android",
      "appVersion": "2.4.0",
      "timestamp": 1793197700000,
      "clientTimezone": "Asia/Kolkata",
      "metrics": {
        "speed": 13.8,
        "batteryLevel": 84.5
      }
    }
  ]
}
```
- **Response (202 Accepted)**:
```json
{
  "status": "queued",
  "batchId": "batch_mob_1793197706738_8921",
  "queuedCount": 2,
  "duplicateCount": 0,
  "timestamp": "2026-10-31T06:05:05.000Z"
}
```

### 4.4 Automated Fraud Detection & Emulator Heuristics
Each signal processed by the asynchronous telemetry worker is automatically evaluated against four heuristic security layers:
1. **Timezone vs IP Geolocation Mismatch**: Compares client-reported `clientTimezone` country against the requesting IP geolocation. Flags mismatches (e.g. client claims `Asia/Kolkata` but requests from US IP).
2. **Rapid Battery Jump Anomaly**: Detects impossible battery percentage swings ($> 30%$ within 30-60s) indicating simulated/mock emulator state.
3. **Emulator Hardware Fingerprints**: Scans device metadata for emulator indicators (`sdk_gphone`, `ranchu`, `goldfish`, `qemu`, `vbox86`, `isEmulator = true`, `isMockLocation = true`).
4. **Zero-Entropy IMU Check**: Detects mock sensors where accelerometer reports exactly `0, 0, 0`, missing physical Earth gravity ($1G approx 9.8	ext{ m/s}^2$).

Signals with **FraudScore $ge 30$** are flagged with `isFraudDetected: true` and annotated with explicit diagnostic reason strings.

### 4.5 `GET /api/v1/telemetry/stats`
Returns real-time consumer operational telemetry, queue depth, and calculated session duration metrics.
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Telemetry Ingestion & Processing Pipeline Statistics",
  "data": {
    "queue": {
      "pendingCount": 0,
      "isPaused": false
    },
    "worker": {
      "processedBatches": 14,
      "processedEvents": 2840,
      "fraudEventsDetected": 12,
      "openStopRate": 0.042,
      "avgProcessingLatencyMs": 14.8
    },
    "systemTimestamp": "2026-10-31T06:10:00.000Z"
  }
}
```

### 4.6 `GET /api/v1/telemetry/logs`
Queries persisted telemetry events from MongoDB with pagination and filtering.
- **Query Parameters**:
  - `deviceId`: Filter by specific hardware device ID.
  - `sessionId`: Filter by navigation or app session ID.
  - `eventType`: `heartbeat` | `session_start` | `session_end` | `sensor_batch` | `telematics` | `navigation_ping` | `app_state_change`
  - `isFraudDetected`: `true` | `false`
  - `page`: Integer (default: 1)
  - `limit`: Integer (default: 50, max: 500)

---

## 5. Real-Time Crowdsourced Traffic, Dynamic ETAs & Anomaly Suppression (`/traffic`)

Calculates live road network speeds, Bureau of Public Roads (BPR) congestion penalties, and ETAs strictly in **travel time minutes (not static distance)**. Models intersections as nodes and road segments as directed edges.

### 5.1 `POST /api/v1/traffic/telemetry`
Ingests anonymized velocity vectors. Applies cryptographic hashing to `deviceId` to ensure driver privacy, computes segment harmonic mean speeds, and updates road graph weights.
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

### 5.2 `POST /api/v1/traffic/eta`
Computes turn-by-turn dynamic ETA weighted by live traffic travel times and signal cycle delays.
- **Request Body**:
```json
{
  "origin": [77.2185, 28.6328],
  "destination": [77.0715, 28.4725],
  "departureTime": "2026-10-31T08:30:00.000Z"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Real-time traffic ETA computed successfully",
  "data": {
    "totalDistanceKm": 22.9,
    "totalEtaMinutes": 46.8,
    "totalDelayMinutes": 29.2,
    "overallCongestion": "congested",
    "stepsCount": 3,
    "intersectionsCrossed": 3,
    "steps": [
      {
        "segmentId": "SEG_CP_BARAKHAMBA_01",
        "name": "Barakhamba Road Corridor",
        "distanceKm": 1.4,
        "travelTimeMinutes": 7.39,
        "currentSpeedKmh": 18.2,
        "congestionLevel": "congested"
      }
    ]
  }
}
```

### 5.3 `POST /api/v1/traffic/evaluate-anomaly`
Filters out single-device false positives (such as 1 scooter stopping at a roadside tea stall while other traffic flows at 58 km/h) using spatial DBSCAN clustering and quorum rules ($ge 3$ corroborated vehicles required for congestion confirmation).
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
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Anomaly evaluation completed",
  "data": {
    "lateralOffsetMeters": 15.7,
    "speedKmh": 2.0,
    "segmentAverageSpeedKmh": 58.0,
    "activeClusterSize": 1,
    "isExcludedFromAggregation": true,
    "explanation": "Prevented false positive: 1 scooter stopped at roadside tea stall/shoulder while 3 surrounding devices flow at 58.0 km/h."
  }
}
```

### 5.4 `GET /api/v1/traffic/graph`
Retrieves the directed road graph topology: intersections as nodes (signal cycle wait times) and road segments as edges weighted in minutes.

### 5.5 `GET /api/v1/traffic/segments`
Lists all monitored road segments with live speeds, congestion classifications (`free_flow`, `slow`, `congested`, `severe_gridlock`), and BPR travel times.

### 5.6 `GET /api/v1/traffic/predict`
Combines live telemetry with historical speed distributions across 15-minute time windows (96 buckets per day).
- **Query Parameters**: `segmentId=SEG_CP_BARAKHAMBA_01&targetTime=2026-10-31T09:15:00.000Z`

### 5.7 `GET /api/v1/traffic/shockwave/:segmentId`
Evaluates macroscopic Lighthill-Whitham-Richards (LWR) conservation dynamics: shockwave velocity ($w = Delta q / Delta k$), propagation direction (`BACKWARD_FORMING` vs `FORWARD_RECOVERING`), and exact spillback minutes until upstream junctions block.

### 5.8 `POST /api/v1/traffic/eco`
Physics-based multi-powertrain energy consumption comparison: Petrol ICE ($eta = 0.30$), Diesel ICE ($eta = 0.34$), and EV ($eta = 0.88$ with 70% regenerative braking credit).

### 5.9 `POST /api/v1/traffic/security/anti-spoofing`
Kinematic plausibility engine: blocks GPS teleportation ($v > 220	ext{ km/h}$) and impossible acceleration ($a > 6.5	ext{ m/s}^2$).

### 5.10 `POST /api/v1/traffic/security/proof-of-presence`
Issues an authenticated, tamper-proof Proof-of-Presence certificate signed with HMAC-SHA256.

### 5.11 `POST /api/v1/traffic/security/proof-of-presence/verify`
Verifies an issued Proof-of-Presence certificate against public verification authorities.

---

## 6. App Version Governance & Dynamic Frontend OTA Patching (`/app-version` & `/version`)

Authoritative sovereign release version is **`1.0.0`**. Enforces semantic versioning, minimum supported versions, and dynamic Over-The-Air (OTA) delta JavaScript bundle patching via REST API.

### 6.1 `GET /api/v1/app-version/current`
Returns authoritative backend sovereign version.
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Current authoritative backend version retrieved",
  "data": {
    "appVersion": "1.0.0",
    "environment": "production",
    "service": "B-Map Sovereign Geospatial Platform",
    "timestamp": "2026-10-31T06:00:00.000Z"
  }
}
```

### 6.2 `GET /api/v1/app-version/latest`
Returns latest active version specifications and patch releases across all supported platforms (`web`, `android`, `ios`, `desktop`).

### 6.3 `GET /api/v1/app-version/check` / `POST /api/v1/app-version/check`
Evaluates installed client version against minimum required versions and available OTA hot-reload bundles.
- **Request Parameters / Body**:
```json
{
  "platform": "web",
  "version": "1.0.0",
  "buildNumber": 100
}
```
- **Response (200 OK)**:
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

### 6.4 `PATCH /api/v1/app-version/patch`
**Dynamic OTA Patch API**: Updates client release version metadata, release notes, and hot-reload bundle URLs via API. Emits a WebSocket broadcast (`app_version:update_available`) to active clients.
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

### 6.5 `POST /api/v1/app-version/broadcast`
Manually triggers a real-time Socket.IO version push notification across connected frontends.
- **Request Body**: `{ "platform": "web" }`

---

## 7. Core Routing Engine, Directions & TSP Multi-Stop Optimization (`/routes`)

Connects to OSRM with sub-millisecond Redis caching, alternative route discovery, Traveling Salesperson Problem (TSP) optimization, and GPS map matching.

### `GET /api/v1/routes/directions`
Computes turn-by-turn routes with polyline geometry, maneuvers, step instructions, and Redis caching.
- **Query Parameters**:
  - `origin`: `lon,lat` (e.g. `77.2185,28.6328`)
  - `destination`: `lon,lat` (e.g. `77.0715,28.4725`)
  - `waypoints`: Delimited `lon,lat|lon,lat`
  - `profile`: `driving` | `bike` | `foot` (default: `driving`)
  - `alternatives`: `true` | `false`

### `POST /api/v1/routes/optimize`
Solves Traveling Salesperson Problem (TSP) for courier delivery stop sequences.
- **Request Body**:
```json
{
  "coordinates": [
    [77.2185, 28.6328],
    [77.2295, 28.6128],
    [77.2085, 28.6428]
  ],
  "profile": "driving",
  "roundtrip": true
}
```

### `POST /api/v1/routes/match`
Snaps noisy GPS tracks to the underlying road network using Hidden Markov Model (HMM) map matching.
- **Request Body**:
```json
{
  "coordinates": [
    [77.2185, 28.6328],
    [77.2187, 28.6331]
  ],
  "timestamps": [1793197700000, 1793197705000]
}
```

### `GET /api/v1/routes/matrix`
Calculates $N 	imes M$ distance and duration matrix.
- **Query Parameters**: `coordinates=77.21,28.63;77.22,28.64;77.23,28.65`

---

## 8. Geospatial Places & POI Proximity Search (`/places`)

Indexed with MongoDB `2dsphere` indexes for sub-meter radial distance lookups and GeoJSON polygon searches.

### `POST /api/v1/places`
Creates a Point of Interest (POI).
- **Request Body**:
```json
{
  "name": "DLF CyberHub Gurugram",
  "category": "commercial_complex",
  "coordinates": [77.0885, 28.4955],
  "tags": ["food", "offices", "ev_charging"]
}
```

### `GET /api/v1/places/nearby`
Finds POIs ordered by spherical geodesic distance via MongoDB `$near`.
- **Query Parameters**: `longitude=77.0885&latitude=28.4955&maxDistance=5000&category=food`

### `POST /api/v1/places/within-polygon`
Queries POIs enclosed within a GeoJSON polygon boundary via `$geoWithin`.

### `GET /api/v1/places/search`
Text search across names, tags, and categories.
- **Query Parameters**: `q=CyberHub&category=commercial_complex`

### `GET /api/v1/places/:id`
Retrieves detailed POI metadata.

### `GET /api/v1/places/top-rated/discover`
Discovers top-rated places and POIs sorted by rating score and review count.
- **Query Parameters**: `category=commercial_complex&limit=10`

### `POST /api/v1/places/:placeId/ratings`
Submits or updates a place rating and review.
- Enforces one review per user per place (subsequent submissions update existing review).
- Automatic **Geodesic Verified Visit Detection**: If user coordinate is within 250m of POI, or if `proofOfPresenceSignature` is present, sets `isVerifiedVisit = true`.
- Automatically recalculates cached `Place.rating` and `Place.reviewCount`.
- **Request Body**:
```json
{
  "userId": "usr_kavita_01",
  "userName": "Kavita Menon",
  "score": 4.8,
  "title": "Accessible, vibrant pedestrian mall",
  "review": "Seamless wheelchair ramps and high-speed EV chargers.",
  "aspects": {
    "cleanliness": 5,
    "accessibility": 5,
    "hospitality": 4,
    "valueForMoney": 4,
    "amenities": 5
  },
  "visitType": "family",
  "tags": ["wheelchair_friendly", "clean_restrooms"],
  "userCoordinate": [77.0886, 28.4956]
}
```

### `GET /api/v1/places/:placeId/ratings`
Retrieves paginated reviews for a place with filtering and sorting.
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20)
  - `sortBy`: `most_helpful` | `newest` | `oldest` | `highest` | `lowest`
  - `minScore`: Minimum star score filter (e.g. `4`)
  - `maxScore`: Maximum star score filter (e.g. `5`)
  - `verifiedOnly`: `true` to filter strictly verified visits

### `GET /api/v1/places/:placeId/ratings/summary`
Returns comprehensive rating statistics, star distribution (1 to 5 stars), granular aspect score averages, recommendation percentage, and automated sentiment analysis.

### `GET /api/v1/places/:placeId/ratings/my-review`
Retrieves the authenticated user's existing review for this place.
- **Query Parameters**: `userId=usr_kavita_01` (or extracted from JWT `Authorization: Bearer <token>`)

### `POST /api/v1/places/:placeId/ratings/:ratingId/helpful`
Toggles an upvote on a review as helpful. Subsequent calls by the same user toggle the vote off idempotently.

### `POST /api/v1/places/:placeId/ratings/:ratingId/report`
Reports an inappropriate or spam review for moderation. Upon reaching 3 reports, the review status transitions to `under_review` and is hidden from public view.

### `DELETE /api/v1/places/:placeId/ratings/:ratingId`
Deletes a review. Authorized for the review's original author or system administrators.

### `POST /api/v1/places/user/visit`
Records a user location ping or POI visit.
- Updates place visit frequency and clusters coordinates into spatial stay-points ($\le 35\text{m}$).
- Updates rolling average speed and cumulative dwell minutes.
- **Request Body**:
```json
{
  "userId": "usr_traveler_01",
  "placeId": "poi_cyber_hub_01",
  "placeName": "DLF CyberHub Gurugram",
  "coordinates": [77.0885, 28.4955],
  "speedKmH": 1.2,
  "dwellMinutes": 45
}
```

### `GET /api/v1/places/user/visited-places`
Returns the user's visited places with dynamic visual scaling.
- **Algorithm**: Most frequently visited places are scaled strictly larger via logarithmic saturation:
  $$R_{\text{place}} = R_{\min} + (R_{\max} - R_{\min}) \cdot \left(\frac{\ln(1 + V)}{\ln(1 + V_{\text{cap}})}\right)^{0.85}$$
- Returns `markerRadiusPx` ($12\text{px}$ to $44\text{px}$), `influenceRadiusMeters` ($15\text{m}$ to $120\text{m}$), and prominence tier (`compact`, `regular`, `frequent`, `landmark_hub`).
- **Query Parameters**: `userId=usr_traveler_01&minRadiusPx=12&maxRadiusPx=44`

### `GET /api/v1/places/user/visited-spots`
Returns the user's visited spots scaled by the **"Slow Large" Algorithm**.
- **Algorithm**: Spots with high visit frequency **AND** slow movement speeds (pedestrian, stationary, high dwell time) expand prominently on the map, whereas fast transit corridors (expressway speeds) are suppressed:
  $$W_{\text{slow}}(v) = \frac{1}{1 + (v / 6.0)^{1.8}}$$
  $$W_{\text{spot}} = \ln(1 + V) \cdot (0.35 + 0.65 \cdot W_{\text{slow}}) \cdot (0.70 + 0.30 \cdot D_{\text{dwell}})$$
  $$R_{\text{spot}} = R_{\min} + (R_{\max} - R_{\min}) \cdot \left(\frac{W_{\text{spot}}}{W_{\text{cap}}}\right)^{0.80}$$
- High-visit slow spots receive `isSlowLarge: true` and `growthClassification: "slow_large_expanded"`.
- **Query Parameters**: `userId=usr_traveler_01`

### `GET /api/v1/places/user/map-layer`
Generates a complete MapLibre/Mapbox-ready GeoJSON payload containing both `placesLayer` (FeatureCollection with graduated circles) and `spotsLayer` (FeatureCollection with slow-large footprints and heat intensity).
- **Query Parameters**: `userId=usr_traveler_01`

### `POST /api/v1/places/user/calculate-scale`
Stateless batch calculator for testing and client-side simulation of place and slow-spot dynamic scaling.

---

## 9. Active Navigation Sessions & Sub-Second Dynamic Rerouting (`/navigation`)

Manages client active navigation sessions, lateral cross-track error (XTD) monitoring, step progression, and instant rerouting.

### `POST /api/v1/navigation/start`
Initializes an active navigation session.
- **Request Body**:
```json
{
  "userId": "usr_driver_amit_01",
  "origin": [77.2185, 28.6328],
  "destination": [77.0715, 28.4725],
  "profile": "driving"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Navigation session started",
  "data": {
    "sessionId": "nav_1793197778_64a255ec",
    "route": { ... }
  }
}
```

### `POST /api/v1/navigation/progress`
Submits continuous GPS progress. If vehicle's geodesic Cross-Track Distance exceeds 40m, triggers an automatic sub-second reroute ($< 1000\text{ ms}$).
- **Request Body**:
```json
{
  "sessionId": "nav_1793197778_64a255ec",
  "currentLocation": [77.1500, 28.5200],
  "bearing": 185.4,
  "speedKmph": 48.2
}
```

### `GET /api/v1/navigation/:sessionId`
Retrieves active session state, current step, remaining distance, and ETA.

### `POST /api/v1/navigation/:sessionId/end`
Terminates the navigation session.

---

## 10. Live Vehicle & Driver Tracking Primitives (`/tracking`)

High-throughput driver location ingestion and radial proximity queries using Redis in-memory geospatial indexes (`GEOADD` and `GEOSEARCH`).

### `POST /api/v1/tracking/update`
Ingests driver position into Redis geospatial index.
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
Finds active online drivers within a radial distance.
- **Query Parameters**: `longitude=77.2100&latitude=28.6200&radiusKm=3&vehicleType=auto_rickshaw`

### `GET /api/v1/tracking/:userId`
Retrieves real-time tracking coordinates for a specific user or driver.

---

## 11. Location Access, Ephemeral Tokenization & Permissions (`/location` & `/location-access`)

Zero-trust driver location privacy lifecycle, time-limited trip tokenization, and granular permission revocation.
- `POST /api/v1/location/ingest`: Ingests privacy-sanitized coordinates.
- `POST /api/v1/location/lifecycle-mode`: Switches driver tracking between `off`, `foreground_only`, and `background_active`.
- `POST /api/v1/location/session/register`: Initiates trip token session.
- `POST /api/v1/location/session/:tripId/terminate`: Concludes trip tracking.
- `POST /api/v1/location/session/tokenize-trip`: Issues a privacy-safe ephemeral trip token.
- `POST /api/v1/location/session/refresh-trip-token`: Renews an active trip token.
- `POST /api/v1/location/permissions/revoke`: Instantly revokes client location access.
- `GET /api/v1/location/permissions/:userId`: Retrieves user location permissions.
- `PUT /api/v1/location/permissions/state`: Modifies granular permissions.

---

## 12. Motion, Physical Fitness & Stationary Detection (`/motion` & `/motion-fitness`)

Fused IMU pedometer step counting, activity state classification (`stationary`, `walking`, `cycling`, `in_vehicle`), and trip fitness analytics.
- `POST /api/v1/motion/activity`: Submits physical sensor motion frame.
- `POST /api/v1/motion/resume`: Resumes paused fitness session.
- `GET /api/v1/motion/trip/:tripId`: Retrieves distance, cadence, and calorie burn summaries.

---

## 13. Targeted Notifications, APNS/FCM & Spatial Geofencing (`/notifications`)

Device push token registration, targeted dispatch, and polygon geofence breach evaluation.
- `POST /api/v1/notifications/devices/register`: Registers APNS / FCM device token.
- `DELETE /api/v1/notifications/devices/:token`: Unregisters push token.
- `GET /api/v1/notifications/devices/:userId`: Lists user registered devices.
- `POST /api/v1/notifications/send-targeted`: Sends targeted alert to device.
- `POST /api/v1/notifications/geofence/register`: Creates circular or polygon geofence.
- `POST /api/v1/notifications/geofence/evaluate`: Evaluates vehicle coordinates against geofence triggers.
- `GET /api/v1/notifications/geofence/list`: Lists active geofences.

---

## 14. Nearby Peripherals, Bluetooth & Indoor BLE Beacon Registry (`/nearby-devices` & `/bluetooth`)

Underground BLE beacon trilateration and Bluetooth peripheral management.
- `POST /api/v1/nearby-devices/permissions/verify`: Verifies Bluetooth scan authorization.
- `POST /api/v1/nearby-devices/beacons/translate`: Converts BLE UUID, Major, Minor, and RSSI into calibrated underground floor coordinates.
- `GET /api/v1/nearby-devices/beacons`: Lists registered BLE beacons.
- `GET /api/v1/nearby-devices/beacons/:beaconId`: Details for specific beacon.
- `POST /api/v1/nearby-devices/beacons`: Registers a new calibrated beacon.

---

## 15. High-Precision Positioning, RTK Decimeter & Weak-Signal Fusion (`/positioning`)

Continuous-Time White Noise Acceleration (CWNA) Extended Kalman Filter (EKF) sensor fusion, RTK CORS baseline corrections, and tunnel dead-reckoning.
- `POST /api/v1/positioning/fuse`: Ingests GNSS + IMU accelerometer/gyro + Odometry packet and outputs sub-meter smoothed position.
- `POST /api/v1/positioning/anchors`: Registers indoor/tunnel ground-truth anchors.
- `GET /api/v1/positioning/anchors/nearby`: Finds nearby positioning anchors.
- `POST /api/v1/positioning/rtk/base-station`: Connects CORS RTK base station.

---

## 16. HD Lane-Level Routing & "Veteran Driver" Layering (`/lane-routing`)

Multi-lane highway guidance, Bus/HOV lane time restrictions, and crowdsourced local shortcuts.
- `POST /api/v1/lane-routing/guidance`: Returns exact lane assignment and proactive lane-change maneuvers before highway exits.
- `POST /api/v1/lane-routing/plan`: Routes with Veteran Driver personas (`veteran_fast`, `veteran_smooth`, `novice_friendly`, `commuter_smart`).
- `POST /api/v1/lane-routing/veteran/experience`: Crowdsources local shortcut links.
- `POST /api/v1/lane-routing/segments`: Registers HD lane topology.

---

## 17. Spatial Reality (SR) HUD Navigation & 3D Junction Cards (`/sr-navigation`)

Windshield Head-Up Display (HUD) projection, Lane Departure Warning (LDW), Forward Collision Warning (FCW), and photorealistic 3D Junction Cards.
- `POST /api/v1/sr-navigation/hud-state`: Computes lateral lane offset, LDW unblinker drift, and forward collision metrics.
- `POST /api/v1/sr-navigation/roads`: Registers 3D lane markings.
- `GET /api/v1/sr-navigation/roads/:segmentId`: Retrieves HD road model.

---

## 18. Automotive IVI, CAN-Bus & Apple CarPlay / Android Auto (`/automotive`)

Connected vehicle in-cabin infotainment templates and OBD-II / CAN-Bus streaming.
- `POST /api/v1/automotive/carplay/template`: Generates Apple CarPlay `CPNavigationTemplate`.
- `POST /api/v1/automotive/android-auto/template`: Generates Android Auto `NavigationTemplate`.
- `POST /api/v1/automotive/aaos/properties`: Ingests native Android Automotive OS (AAOS) VHAL properties.
- `POST /api/v1/automotive/telemetry/can`: Ingests CAN Bus frames; computes Eco-Driving score (0-100).
- `POST /api/v1/automotive/ev/plan`: Smart EV route planning with battery thermal pre-conditioning.
- `POST /api/v1/automotive/hud/frame`: Compact 8-byte optical waveguide HUD binary hex serialization.

---

## 19. Rider Mode Motorcycle Dynamics & e-Call Crash Detection (`/rider-mode`)

Specialized two-wheeler routing, lean angle dynamics, bridge crosswind alerts, and autonomous crash detection.
- `POST /api/v1/rider-mode/route/plan`: Two-wheeler routing avoiding flyover bans and toll gates.
- `POST /api/v1/rider-mode/dynamics`: Ingests IMU roll/pitch; computes lean angle and cornering speed.
- `POST /api/v1/rider-mode/weather-safety`: Evaluates crosswind warnings on bridges ($> 35\text{ km/h}$).
- `POST /api/v1/rider-mode/helmet/cue`: Audio cues formatted for Bluetooth intercoms with audio ducking.
- `GET /api/v1/rider-mode/glove-ui`: 4-button oversized touchscreen layout for gloves.
- `POST /api/v1/rider-mode/crash/detect`: Fall detection e-Call ($G > 3.8g$, $\text{tilt} > 65^\circ$).
- `POST /api/v1/rider-mode/crash/cancel/:eventId`: Rider cancels distress dispatch.
- `GET /api/v1/rider-mode/hazards/nearby`: Queries two-wheeler road hazards.
- `POST /api/v1/rider-mode/hazards/report`: Crowdsources road hazards.

---

## 20. Multilevel Space-Level Indoor Parking Navigation (`/parking`)

Seamless outdoor-to-indoor transition, multi-floor A* ramp pathfinding, and reverse Find My Car guidance.
- `POST /api/v1/parking/entrance/detect`: Detects facility gate arrival.
- `GET /api/v1/parking/facilities/:facilityId`: Facility floor plans, ramps, and elevators.
- `GET /api/v1/parking/facilities/:facilityId/bays`: Query bays filtered by floor, EV charger type, and vacancy.
- `POST /api/v1/parking/indoor/plan`: Turn-by-turn guidance from entrance barrier directly into designated bay.
- `POST /api/v1/parking/find-my-car`: Reverse pedestrian route from elevator to parked vehicle.
- `POST /api/v1/parking/reserve`: 30-minute space reservation with PIN.
- `POST /api/v1/parking/check-in`: Check-in arrival confirmation.
- `POST /api/v1/parking/check-out`: Concludes parking session and calculates fees.

---

## 21. Multi-Mode: Intelligent Car Navigation & Speed Radars (`/car-nav` & `/car-navigation`)

Multi-strategy car routing, multi-stop sequence optimization, and speed radar camera queries.
- `POST /api/v1/car-nav/plan`: Evaluates `fastest`, `shortest`, `avoid_tolls`, `avoid_highways`, and `eco_friendly` strategies.
- `POST /api/v1/car-nav/optimize-stops`: TSP multi-stop optimizer with arrival time windows.
- `GET /api/v1/car-nav/cameras/nearby`: Queries speed enforcement, red-light, and average speed section control cameras.

---

## 22. Multi-Mode: Multimodal Public Transit Mastery (`/transit` & `/public-transit`)

Subway, commuter rail, tram, and feeder bus journeys with carriage boarding advice and real-time departure boards.
- `POST /api/v1/transit/itinerary`: Plans multimodal transit journeys with walking legs and platform transfer tips.
- `GET /api/v1/transit/stations/:stationId/departures`: Live station departure board with platform numbers and vehicle IDs.
- `GET /api/v1/transit/stations/nearby`: Discovers nearby transit interchanges.

---

## 23. Multi-Mode: Augmented Reality (AR) Walk & Cycle Navigation (`/ar-walk-cycle`)

AR viewport world anchors, accessible pedestrian paths (no stairs, curb ramps), bicycle elevation profiles, and **Multimodal AI Visual Landmark Search from User Photos**.

### 23.1 `POST /api/v1/ar-walk-cycle/visual-search`
*(Alias: `POST /api/v1/navigation/ar-visual-search`)*  
Accepts a photo uploaded by the user, runs the Multimodal AI Visual Localization algorithm (EXIF inspection, architectural signature matching, signboard OCR), pinpoints geographic coordinates, resolves the 4m×4m National DigiPIN, and generates real-time AR navigation guidance with 3D HUD screen projections.
- **Access Level**: Public
- **Request Body**:
```json
{
  "image": "data:image/jpeg;base64,... (or image URL / raw base64)",
  "hint": "india gate war memorial kartavya path",
  "userLocation": [77.2185, 28.6328],
  "cameraPose": {
    "yawDegrees": 115,
    "pitchDegrees": 0,
    "fovHorizontalDegrees": 68
  }
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "AI visual landmark localization identified: India Gate (All India War Memorial)",
  "data": {
    "analysisId": "ar_vis_1793427000_a1b2c3",
    "timestamp": 1793427000000,
    "querySummary": {
      "imageSizeBytes": 452000,
      "hasExifGps": false,
      "userLocationProvided": true,
      "appliedSearchRadiusMeters": 50000
    },
    "imageAnalysis": {
      "detectedSceneType": "historic_landmark",
      "extractedTextList": ["India Gate", "War Memorial"],
      "detectedFeatures": [
        {
          "type": "signboard_ocr",
          "label": "India Gate",
          "confidence": 0.95,
          "details": "Signboard OCR detected text label 'India Gate' in camera viewport"
        },
        {
          "type": "architectural_style",
          "label": "Triumphal Arch / Monumental Gateway",
          "confidence": 0.92,
          "details": "Recognized bilateral symmetrical sandstone arch structure with central vault"
        }
      ]
    },
    "topMatch": {
      "locationId": "lm_india_gate_delhi",
      "name": "India Gate (All India War Memorial)",
      "category": "historic_monument",
      "coordinates": [77.2295, 28.6129],
      "address": "Kartavya Path, India Gate, New Delhi",
      "city": "New Delhi",
      "state": "Delhi",
      "digipin": "LT-KH-LH-JE-L2",
      "confidenceScore": 0.99,
      "matchGrade": "EXACT_MATCH",
      "visualEvidence": [
        "Signboard OCR recognized 'india gate' matching landmark 'India Gate (All India War Memorial)'",
        "Visual AI architecture analyzer identified 'Triumphal Arch / Monumental Gateway'",
        "Geospatial search radius verified landmark is 2.4km from user"
      ],
      "distanceMeters": 2400,
      "bearingDegrees": 115,
      "clockDirection": "12 o'clock (straight ahead)",
      "cardinalDirection": "South-East",
      "estimatedWalkingMinutes": 32
    },
    "arGuidance": {
      "targetName": "India Gate (All India War Memorial)",
      "distanceText": "2.4 km",
      "compassBearingDegrees": 115,
      "clockDirection": "12 o'clock (straight ahead)",
      "relativeDirectionText": "at your 12 o'clock (straight ahead) (South-East)",
      "floatingBillboardsCount": 9,
      "nextStepInstruction": "Head South-East (12 o'clock (straight ahead)). India Gate (All India War Memorial) is 2.4 km ahead.",
      "arHUDFrame": {
        "timestamp": 1793427000000,
        "currentStepInstruction": "Walk towards India Gate (All India War Memorial) (12 o'clock (straight ahead))",
        "distanceToNextTurnMeters": 45,
        "projectedAnchors": [
          {
            "anchorId": "beacon_lm_india_gate_delhi",
            "type": "destination_beacon",
            "screenXPercent": 50,
            "screenYPercent": 28,
            "distanceMeters": 2400,
            "scale": 0.35,
            "isVisibleInView": true,
            "label": "📍 INDIA GATE (ALL INDIA WAR MEMORIAL)"
          }
        ]
      }
    }
  }
}
```

### 23.2 `GET /api/v1/ar-walk-cycle/view` (Interactive AR Visual Navigation Web UI)
*(Alias: `GET /api/v1/ar-walk-cycle/visual-search/view`)*  
Serves a self-contained, responsive, dark-mode glassmorphic Web Application that allows users to drag-and-drop or snap location photos, choose 1-click sample landmarks (India Gate, DLF CyberHub, Rajiv Chowk, Gateway of India, Vidhana Soudha, Charminar), run the AI visual search algorithm, and inspect an interactive simulated AR camera HUD with 3D destination beacons, ground chevrons, and turn-by-turn guidance.
- **Access Level**: Public
- **Content-Type**: `text/html; charset=utf-8`

### 23.3 Standard AR & Pedestrian Routing Endpoints
- `POST /api/v1/ar-walk-cycle/ar/hud-frame`: Projects 3D world anchors onto camera coordinates (`screenX%`, `screenY%`, depth distance).
- `POST /api/v1/ar-walk-cycle/walk/plan`: Accessible pedestrian walking routes.
- `POST /api/v1/ar-walk-cycle/cycle/plan`: Bicycle routing with elevation profile, slope percentage, and calories burned.
- `GET /api/v1/ar-walk-cycle/cycle/amenities`: Locates air pumps, bike repair stands, and e-bike charging hubs.

---

## 24. Conversational AI Voice Copilot & Gemma LLM Engine (`/ai-copilot`)

Natural language conversational copilot with local Gemma LLM fallback, multimodal vision OCR, and predictive travel time forecasting.
- `POST /api/v1/ai-copilot/chat`: Multi-turn conversational voice copilot. Employs agentic tool execution (`search_pois_along_route`, `reroute_traffic_avoidance`, `find_fatigue_rest_stop`, `query_smart_parking_bay`).
- `GET /api/v1/ai-copilot/conversations/:conversationId`: Retrieves dialogue context.
- `POST /api/v1/ai-copilot/vision/analyze`: Vision AI frame analyzer detecting potholes, debris, and reading traffic signs.
- `GET /api/v1/ai-copilot/vision/incidents/nearby`: Discovers vision-detected hazards nearby.
- `POST /api/v1/ai-copilot/traffic/forecast`: Spatio-temporal predictive departure time optimizer.
- `GET /api/v1/ai-copilot/poi/intelligence`: Generates in-car destination audio arrival briefings.
- `GET /api/v1/ai-copilot/health`: Checks Gemma LLM microservice connection.
- `GET /api/v1/ai-copilot/status`: AI copilot service state.
- `GET /api/v1/ai-copilot/model/status`: Local LLM weights and VRAM status.
- `POST /api/v1/ai-copilot/model/start`: Spins up local LLM worker.

---

## 25. AI-Powered Data Production & Big-Data Trajectory Mining (`/data-mining` & `/ai-data-mining`)

ST-DBSCAN stay-point extraction, curbside PUDO entrance mining, POI deduplication, and automated road network change detection.
- `POST /api/v1/data-mining/trajectories/mine-staypoints`: Mines dwell points and curbside PUDO building entrances.
- `POST /api/v1/data-mining/poi/resolve`: Entity resolution and Master Golden Record fusion.
- `POST /api/v1/data-mining/road-production/detect-new-roads`: Extracts new road centerlines from trajectory clusters.
- `POST /api/v1/data-mining/road-production/detect-closure`: Anomaly detection for unmapped road closures.
- `GET /api/v1/data-mining/road-production/changes`: Lists AI-identified road changes.

---

## 26. Unified Underlying Navigation Lifecycle Engine (`/unified` & `/unified-engine`)

Coordinates positioning, routing, lane guidance, and proactive contextual recommendations in sub-10ms.
- `POST /api/v1/unified/session/start`: Binds positioning, routing, and recommendations into a unified session.
- `POST /api/v1/unified/tick`: Ingests high-frequency sensor ticks (GNSS + IMU + Odo + Battery).
- `POST /api/v1/unified/recommendations/accept`: Accepts recommendation (faster route bypass, parking spot).
- `POST /api/v1/unified/recommendations/dismiss`: Dismisses recommendation.

---

## 27. 4D Dynamic Space Rendering, 3D Digital Twins & 360° Street View (`/spatial-vis` & `/spatial-visualization`)

360-degree spherical panoramas covering >95% Indian urban centers, interactive multi-floor indoor digital twins, and diurnal 4D time-slider space rendering.
- `GET /api/v1/spatial-vis/buildings/3d`: 3D building vector meshes.
- `GET /api/v1/spatial-vis/tiles/:z/:x/:y`: Vector map tile slice.
- `POST /api/v1/spatial-vis/heatmaps/hexagonal`: H3 hexagonal density aggregation.
- `GET /api/v1/spatial-vis/street-view/coverage`: Street View coverage statistics (>520 urban centers, 1.25M+ km mapped).
- `GET /api/v1/spatial-vis/street-view/cities`: Directory of Indian cities with street view.
- `GET /api/v1/spatial-vis/street-view/nearest`: Nearest 8K spherical panorama lookup by coordinate.
- `GET /api/v1/spatial-vis/street-view/panorama/:panoId`: 8K equirectangular panorama with LiDAR depth buffers and Metro pillar AR markers.
- `POST /api/v1/spatial-vis/street-view/sequence`: Drive-through 360 sequence along corridor.
- `POST /api/v1/spatial-vis/street-view/depth-measure`: Sub-meter LiDAR depth measurement from pixels.
- `GET /api/v1/spatial-vis/indoor/facilities`: Catalog of international airports, railway mega-hubs, and malls.
- `GET /api/v1/spatial-vis/indoor/facilities/:facilityId`: Multi-floor digital twin metadata.
- `GET /api/v1/spatial-vis/indoor/facilities/:facilityId/floors/:floorLevel`: Interactive floor plan (DigiYatra gates, CISF checkpoints, baggage carousels).
- `POST /api/v1/spatial-vis/indoor/facilities/:facilityId/route`: Multi-floor indoor turn-by-turn routing with vertical elevators/escalators.
- `GET /api/v1/spatial-vis/dynamic-4d/scene`: 4D space rendering with diurnal lighting phases and monsoon reflections.
- `POST /api/v1/spatial-vis/dynamic-4d/time-slider`: 4D temporal evolution interpolation.

---

## 28. Unified Lifestyle & Commercial Super-App Ecosystem (`/super-app`)

Ride-hailing lifecycle, lifestyle venue dining/wellness reservations, and offline map delta bundle synchronization.
- `POST /api/v1/super-app/rides/quote`: Real-time ride fare quotes across Auto, Bike, Prime Sedan, and EV.
- `GET /api/v1/super-app/rides/drivers/nearby`: Active drivers within radius.
- `POST /api/v1/super-app/rides/request`: Requests ride and generates 4-digit start OTP.
- `GET /api/v1/super-app/rides/:bookingId`: Live ride tracking and assigned driver details.
- `POST /api/v1/super-app/rides/:bookingId/verify-otp`: Verifies 4-digit OTP to start trip.
- `POST /api/v1/super-app/rides/:bookingId/complete`: Concludes trip and settles digital fare invoice.
- `POST /api/v1/super-app/rides/:bookingId/cancel`: Cancels ride with grace-period fee logic.
- `GET /api/v1/super-app/lifestyle/places`: Lifestyle search with dietary tags (`Pure Veg`, `Jain Available`) and price tiers.
- `GET /api/v1/super-app/lifestyle/places/:poiId`: Venue details and booking slots.
- `POST /api/v1/super-app/lifestyle/book`: Table reservations and appointments with QR code vouchers (`BMAP-XXXXXX`).
- `GET /api/v1/super-app/lifestyle/bookings/:bookingId`: Retrieves booking confirmation.
- `POST /api/v1/super-app/lifestyle/bookings/:bookingId/cancel`: Cancels booking with refund processing.
- `GET /api/v1/super-app/offline/bundles`: Regional offline map bundle directory (Delhi NCR, Mumbai MMR, Bengaluru).
- `GET /api/v1/super-app/offline/bundles/:bundleId`: Bundle manifest (vector tiles, routing graph, SQLite index).
- `GET /api/v1/super-app/offline/bundles/:bundleId/delta`: Differential delta sync (~82.5% bandwidth savings).
- `POST /api/v1/super-app/offline/route-fallback`: Turn-by-turn routing with zero cellular connectivity.
- `GET /api/v1/super-app/offline/storage-quota`: Device storage quota and bundle pruning advisor.

---

## 29. Sovereign Indian GIS: ISRO NavIC Dual-Band Processing (`/navic`)

Dual-frequency L5 (1176.45 MHz) and S-band (2492.028 MHz) pseudorange processing with GAGAN SBAS augmentation to eliminate ionospheric delay, achieving sub-meter accuracy across India and 1,500 km beyond borders.
- `POST /api/v1/navic/fix`: Processes raw NavIC L5/S pseudorange observables.
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
- `GET /api/v1/navic/constellation`: Real-time constellation orbital status for NavIC IRNSS satellites (1A through 1I).

---

## 30. Sovereign Indian GIS: NHAI FASTag Electronic Toll Tariffs (`/tolls`)

Dynamic electronic toll tariffs across National Expressways (Delhi-Mumbai NE-4, Yamuna Expressway, Bengaluru-Mysuru NH-275) segmented across Vehicle Classes 4 through 9, with cashless RFID/ANPR lane guidance.
- `POST /api/v1/tolls/calculate`: Calculates cumulative tolls for a corridor route based on vehicle class.
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
  - **Vehicle Classes**: `CLASS_4` (Car/Jeep, 1.0x), `CLASS_5` (LCV, 1.6x), `CLASS_6` (Bus/Truck, 3.35x), `CLASS_7` (3-Axle, 3.65x), `CLASS_8` (4-6 Axle MAV, 5.25x), `CLASS_9` (7+ Axle OSV, 6.4x), `TWO_WHEELER_EXEMPT` (0 INR).
- `GET /api/v1/tolls/nearby`: Locates nearby NHAI toll plazas within a radial distance.

---

## 31. Sovereign Indian GIS: 6-Digit Department of Posts PINcode Registry (`/pincode`)

Comprehensive Indian postal PIN code database, unformatted address entity parsing, and reverse geocoding.
- `GET /api/v1/pincode/:pincode`: Looks up 6-digit PIN code (post office, district, state, and coordinates).
- `POST /api/v1/pincode/parse-address`: NLP entity parser extracting structured components from messy Indian address strings.
- `GET /api/v1/pincode/reverse`: Resolves latitude and longitude coordinates to the nearest PIN code.

---

## 32. Sovereign Indian GIS: 4m×4m National DigiPIN Micro-Grid Addressing (`/digipin`)

India Department of Posts 10-character deterministic digital addressing system (`XX-XX-XX-XX-XX`) accurate to a 4m×4m micro-grid, strictly using alphanumeric characters `2-9` and consonants (excluding ambiguous glyphs `0, 1, O, I`).
- `GET /api/v1/digipin/encode?lon=77.2185&lat=28.6328`: Encodes coordinates into DigiPIN and 4m×4m bounding polygon.
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
- `GET /api/v1/digipin/decode/:code`: Decodes a 10-character DigiPIN back into its centroid and bounding polygon.

---

## 33. Sovereign Indian GIS: Emergency SOS & Highway Trauma Dispatch (`/emergency`)

Automated emergency SOS dispatch to national emergency helplines (112, NHAI 1033) and nearest trauma centers.
- `POST /api/v1/emergency/sos`: Triggers an emergency SOS event with device coordinates and vehicle profile.
- `GET /api/v1/emergency/facilities/nearby`: Locates nearby trauma hospitals, highway patrol stations, police units, and towing services.

---

## 34. Sovereign Indian GIS: IMD Severe Highway Weather & Fog Advisories (`/weather`)

India Meteorological Department (IMD) colour-coded highway advisories (`GREEN`, `YELLOW`, `ORANGE`, `RED`) with zero-visibility fog (<50m) speed reductions and proactive alternate routing.
- `GET /api/v1/weather/highway`: Real-time weather advisories, visibility distance in meters, and reroute suggestions.
- `GET /api/v1/weather/overrides`: Lists active weather overrides on highway corridors.
- `POST /api/v1/weather/override`: Injects emergency weather override (e.g. dense winter fog, flash flooding).
- `DELETE /api/v1/weather/override/:name`: Removes weather override by corridor name.

---

## 35. Sovereign Indian GIS: 12-Language Vernacular Audio Synthesis (`/vernacular`)

Generates localized turn-by-turn voice prompts and phonetic cues across 12 scheduled Indian languages:
Hindi (`hi`), Tamil (`ta`), Telugu (`te`), Bengali (`bn`), Marathi (`mr`), Gujarati (`gu`), Kannada (`kn`), Malayalam (`ml`), Punjabi (`pa`), Odia (`or`), Assamese (`as`), and English (`en`).
- `POST /api/v1/vernacular/prompt`: Formats navigation instruction into vernacular language with TTS engine hints.
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
- `GET /api/v1/vernacular/languages`: Lists all 12 supported Indian languages with dialect details.

---

## 36. Connected Vehicle V2X, SPaT & GLOSA Green Wave Advisory (`/v2x`)

Vehicle-to-Everything (V2X) Signal Phase and Timing (SPaT) and Green Light Optimal Speed Advisory (GLOSA) to ride the green wave without stopping.
- `GET /api/v1/v2x/signals/nearby`: Discovers connected municipal smart traffic lights.
- `GET /api/v1/v2x/signals/:id`: Specific signal phase, current state, and countdown seconds.
- `POST /api/v1/v2x/glosa/advisory`: Calculates optimal target driving speed (km/h) to clear next intersection on green.

---

## 37. Environmental Intelligence: CPCB AQI, Rooftop Solar & Pollen (`/environment`)

Central Pollution Control Board (CPCB) real-time Air Quality Index, rooftop photovoltaic solar potential, and pollen indices.
- `GET /api/v1/environment/air-quality`: Real-time AQI, PM2.5, PM10, and health category.
- `GET /api/v1/environment/solar`: Annual sunshine hours, solar PV potential, and carbon reduction estimates.
- `GET /api/v1/environment/pollen`: Tree, weed, and grass pollen risk indices.

---

## 38. Crowdsourced Road Hazards, Potholes & Speed Breakers (`/hazards`)

Crowdsourced lookahead warnings for unmarked speed breakers, potholes, road construction, and stray cattle.
- `GET /api/v1/hazards/ahead`: Lookahead query for road hazards within vehicle trajectory cone.
- `POST /api/v1/hazards/report`: Submits hazard report with coordinate, type, and severity.

---

## 39. Differential Privacy & Defense Installation Obfuscation (`/obfuscation`)

National Geospatial Policy compliance: applies 200m–500m spatial coordinate jitter and polygon masking over strategic defense installations.
- `POST /api/v1/obfuscation/defense-mask`: Evaluates coordinate against restricted military polygons and applies spatial jitter.
- `GET /api/v1/obfuscation/defense-zones`: Returns GeoJSON boundary index of restricted defense installations.
- `POST /api/v1/obfuscation/transform`: Datum transformations between WGS84, GCJ02, and BD09.
- `POST /api/v1/obfuscation/fuzz`: Injects planar Geo-Indistinguishability Laplace noise for privacy.

---

## 40. Survey of India (SOI) Territorial Boundaries & Masking (`/boundaries`)

Official Survey of India (SOI) mandated international and territorial boundaries.
- `GET /api/v1/boundaries/territorial`: Sovereign boundary LineString compliant with National Geospatial Policy.
- `GET /api/v1/boundaries/region-highlight`: Sovereign boundary polygon highlight with world dimming mask.

---

## 41. Electric Vehicle (EV) Fast Charging Hubs (`/ev` & `/evcharging`)

Fast-charging hub registry filtered by connector standards (`CCS2`, `Type2`, `Ather Grid`, `Bharat AC001`).
- `GET /api/v1/ev/stations`: Finds nearby EV chargers within radius.
- `GET /api/v1/ev/stations/:id`: Real-time port availability, power ratings (kW), and pricing.

---

## 42. Municipal City Metered Fares (`/fares`)

Official Regional Transport Office (RTO) metered fare estimation for Auto-Rickshaws, Kaali-Peeli taxis, and radio cabs.
- `POST /api/v1/fares/estimate`: Calculates base fare, per-km distance tariff, and night surcharges (23:00 - 05:00).

---

## 43. Roads Geometry Snapping & Speed Limits (`/roads`)

Snaps raw coordinate traces to road centerlines and returns posted speed limits.
- `POST /api/v1/roads/snap-to-roads`: Snaps GPS points to road geometry.
- `GET /api/v1/roads/speed-limits`: Queries speed limits for highway and arterial segments.

---

## 44. Dynamic Vector Tiles & MapLibre Vector Styles (`/maps`, `/tiles`, `/maps-tiles`)

MapLibre/Mapbox compatible dynamic vector tiles and static SVG map rendering.
- `GET /api/v1/maps/style.json`: Vector tile style specification across light, dark, and satellite themes.
- `GET /api/v1/maps/static`: Server-rendered static SVG map with paths and markers.
- `GET /api/v1/maps/clusters`: Server-side geospatial POI clustering.
- `GET /api/v1/tiles/:z/:x/:y`: Dynamic Mapbox Vector Tiles (MVT / GeoJSON).

---

## 45. Commercial Fleet Telemetry & Dispatch (`/fleet`)

Commercial driver telemetry, nearest fleet discovery, and automated trip dispatch.
- `POST /api/v1/fleet/location`: Streams commercial fleet vehicle location.
- `GET /api/v1/fleet/nearby`: Discovers available commercial fleet units within radius.
- `POST /api/v1/fleet/trips/request`: Requests commercial trip dispatch.

---

## 46. Coordinate-to-Timezone Resolution (`/timezone`)

Resolves geographic coordinates to official IANA timezone identifiers.
- `GET /api/v1/timezone?lon=77.2185&lat=28.6328`: Resolves to `Asia/Kolkata` (IST, UTC+05:30).

---

## 47. User Ratings, Feedback & Community Reviews (`/ratings`)

User review submission, aggregate star statistics, and moderation. Also cross-mounts the complete POI Place Rating System for seamless API discoverability.
- `POST /api/v1/ratings`: Submits 1-5 star app rating and review comments.
- `GET /api/v1/ratings/my-rating`: Retrieves current user's rating history.
- `GET /api/v1/ratings/stats`: Aggregated ratings breakdown and average score.
- `GET /api/v1/ratings`: Public feed of verified reviews.

### 47.1 Place / POI Rating Aliases (`/ratings/places`)
- `POST /api/v1/ratings/places/:placeId`: Submit or update place rating and multi-aspect review.
- `GET /api/v1/ratings/places/:placeId`: Paginated place reviews with score, verified visit, and sorting filters.
- `GET /api/v1/ratings/places/:placeId/summary`: Aggregated place rating statistics, star distribution, aspect scores, and sentiment analysis.
- `GET /api/v1/ratings/places/:placeId/my-review`: User's review for this place.
- `POST /api/v1/ratings/places/:placeId/:ratingId/helpful`: Upvote / toggle helpful review vote.
- `POST /api/v1/ratings/places/:placeId/:ratingId/report`: Report review for moderation flagging.
- `DELETE /api/v1/ratings/places/:placeId/:ratingId`: Delete place review.

---

## 48. Enterprise Admin Command Center & Control Portal (`/admin`)

Executive operational telemetry, dynamic runtime feature flags, manual overrides, and audit trails.
*Requires `Authorization: Bearer <token>` with `role: admin`.*

### 48.1 Executive Metrics & Dashboard
- `GET /api/v1/admin/dashboard`: Interactive dark-mode glassmorphic Web Portal.
- `GET /api/v1/admin/overview`: Total users, active sessions, Redis/Mongo status, and average rating.
- `GET /api/v1/admin/analytics/users`: User registration and active session trends.
- `GET /api/v1/admin/analytics/feature-usage`: Usage analytics across tolls, NavIC, routing, and SOS.

### 48.2 User Administration & Access Control
- `GET /api/v1/admin/users`: Paginated, searchable user directory.
- `POST /api/v1/admin/users`: Direct administrative user creation.
- `GET /api/v1/admin/users/:id`: User profile details.
- `PATCH /api/v1/admin/users/:id`: Updates user profile, role (`admin` / `user`), or verification status.
- `DELETE /api/v1/admin/users/:id`: Deletes user (with root admin protection).
- `GET /api/v1/admin/users/stats`: User breakdown statistics.
- `GET /api/v1/admin/users/active`: Currently active users.

### 48.3 System Diagnostics & Dynamic Runtime Configuration
- `GET /api/v1/admin/system/health`: Detailed health diagnostic (DB readyState, Redis keys, Socket connections).
- `GET /api/v1/admin/system/cache`: Redis cache key counts and memory usage.
- `POST /api/v1/admin/system/cache/flush`: Flushes routing cache (`routes`) or all keys (`all`).
- `GET /api/v1/admin/system/config`: Retrieves runtime sovereign feature flags.
- `PATCH /api/v1/admin/system/config`: Dynamically updates flags in real-time without restarting server:
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

### 48.4 Traffic & Weather Overrides
- `GET /api/v1/admin/traffic/overrides`: Lists manual highway traffic overrides.
- `POST /api/v1/admin/traffic/override`: Injects road segment traffic speed multipliers.
- `DELETE /api/v1/admin/traffic/override/:id`: Removes traffic override.
- `GET /api/v1/admin/weather/overrides`: Lists manual weather overrides.
- `POST /api/v1/admin/weather/override`: Injects emergency weather advisory.
- `DELETE /api/v1/admin/weather/override/:name`: Removes weather override.

### 48.5 Road Hazards, Tolls, POIs, Emergencies & Audit Logs
- `GET /api/v1/admin/hazards`: Lists reported road hazards.
- `POST /api/v1/admin/hazards`: Broadcasts official hazard alert.
- `PATCH /api/v1/admin/hazards/:id/verify`: Verifies crowdsourced hazard report.
- `DELETE /api/v1/admin/hazards/:id`: Resolves/deletes hazard.
- `GET /api/v1/admin/tolls`: Lists toll plaza registry.
- `POST /api/v1/admin/tolls`: Registers new toll plaza.
- `PATCH /api/v1/admin/tolls/:id`: Updates toll rates and FASTag status.
- `DELETE /api/v1/admin/tolls/:id`: Deletes toll plaza.
- `GET /api/v1/admin/places`: Master POI directory.
- `POST /api/v1/admin/places`: Creates verified POI.
- `DELETE /api/v1/admin/places/:id`: Deletes POI.
- `GET /api/v1/admin/emergency/incidents`: Real-time log of Highway SOS incidents.
- `PATCH /api/v1/admin/emergency/incidents/:id`: Updates incident status (`ACKNOWLEDGED`, `DISPATCHED`, `RESOLVED`).
- `GET /api/v1/admin/ratings`: Moderation feed of user reviews.
- `DELETE /api/v1/admin/ratings/:id`: Removes spam/inappropriate review.
- `GET /api/v1/admin/audit-logs`: Immutable cryptographic audit trail of all administrative actions.

---

## 49. Socket.IO Real-Time Telematics Gateway: 10 Event Domains

WebSocket Endpoint: `ws://localhost:8080` (or `wss://`)  
Transport: `websocket`, `polling`

| Domain | Event Channel Name | Direction | Room Scoping | Payload Specification & Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **1. Live Driver Tracking** | `location:update`<br/>`location:broadcast`<br/>`location:subscribe` | Bi-directional | Room `driver:<driverId>`<br/>Room `track:<driverId>` | High-frequency 1Hz–5Hz driver coordinates, Redis `GEOADD` ingestion, and subscriber fan-out. |
| **2. Active Turn-by-Turn Nav** | `nav:join`<br/>`nav:update_progress`<br/>`nav:off_route_alert`<br/>`nav:reroute_success` | Bi-directional | Room `nav:<sessionId>` | Continuous step progress, sub-second reroute geometry pushes, and arrival triggers. |
| **3. Weak-Signal Positioning** | `positioning:telemetry`<br/>`positioning:fused_state`<br/>`positioning:subscribe` | Bi-directional | Device Room | EKF 6-state vector, tunnel dead reckoning (up to 10s), and indoor BLE trilateration. |
| **4. HD Lane Guidance** | `lane:guidance_stream`<br/>`lane:guidance_broadcast`<br/>`veteran:hazard_alert` | Bi-directional | Session Room | Sub-meter lateral offset, Bus/HOV restrictions, and early highway lane-change prompts. |
| **5. SR Mixed Reality HUD** | `sr:telemetry_stream`<br/>`sr:hud_broadcast`<br/>`sr:lane_drift_alert`<br/>`sr:collision_warning` | Bi-directional | Vehicle Room | 3D Junction Cards with overhead gantries, Lane Departure Warnings (LDW), and Forward Collision Warnings (FCW). |
| **6. Automotive CAN & IVI** | `auto:can_stream`<br/>`auto:cockpit_sync`<br/>`auto:eco_score_broadcast`<br/>`auto:hud_frame_stream` | Bi-directional | Room `auto:<vehicleId>` | OBD-II / CAN-Bus frame streaming, 0-100 Eco-Driving scores, and 8-byte optical HUD binary serialization. |
| **7. Rider Mode Two-Wheeler** | `rider:dynamics_stream`<br/>`rider:lean_broadcast`<br/>`rider:crash_alert`<br/>`rider:crash_cancel` | Bi-directional | Room `rider:<sessionId>` | Motorcycle IMU roll/pitch dynamics, lean angle advisories, and autonomous e-Call fall/crash detection. |
| **8. Indoor Bay Parking** | `parking:entrance_detect`<br/>`parking:indoor_guidance`<br/>`parking:bay_status` | Bi-directional | Room `parking:<facilityId>` | BLE gate handoff, multi-floor A* ramp pathfinding, and live parking bay occupancy. |
| **9. AI Voice Copilot (Gemma)** | `copilot:message_stream`<br/>`copilot:processing_status`<br/>`copilot:message_response` | Bi-directional | Session Room | Streaming voice transcription tokens, agentic tool execution, and synthesized TTS audio scripts. |
| **10. Traffic & LWR Shockwave** | `traffic:telemetry_stream`<br/>`traffic:segment_update`<br/>`traffic:eta_update`<br/>`traffic:anomaly_filtered` | Bi-directional | Room `segment:<segmentId>` | Real-time crowdsourced velocity streams, BPR speed re-weighting, and LWR shockwave spillback warnings. |

---

*Authoritative Reference generated and verified for B-Map Sovereign Platform Architecture v1.0.0.*
