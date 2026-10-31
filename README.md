# 🗺️ B-Map Navigation Backend

A high-performance, real-time navigation and geospatial backend built with **Node.js**, **TypeScript**, and **Express.js**, featuring **Socket.IO** for live tracking, **MongoDB** with `2dsphere` indexes, **OSRM (Open Source Routing Machine)** for turn-by-turn routing, and **Redis** for sub-millisecond caching and geospatial proximity queries.

---

## 🏛️ Core Architecture

```
                       +---------------------------------------+
                       |           Clients & Frontends         |
                       |  (Mobile App / Web Map / Dashboards)  |
                       +-------------------+-------------------+
                                           |
                    REST Requests          |  WebSocket Events
                   (HTTP / HTTPS)          |  (Socket.IO bi-directional)
                                           |
                                           v
                       +---------------------------------------+
                       |     B-Map Node.js / Express Server    |
                       +-------------------+-------------------+
                                           |
       +-----------------------+-----------+-----------+-----------------------+
       |                       |                       |                       |
       v                       v                       v                       v
+---------------+      +---------------+      +---------------+      +---------------+
|  OSRM Engine  |      |  Redis Cache  |      |   Socket.IO   |      | MongoDB (2ds) |
|               |      |  & Geo Index  |      |   Real-Time   |      |               |
| - /route      |      | - Route Cache |      | - HUD stream  |      | - POIs ($near)|
| - /trip (TSP) |      | - GEOADD      |      | - Reroute push|      | - Trips log   |
| - /match      |      | - GEOSEARCH   |      | - Driver track|      | - GeoJSON     |
| - /table      |      | - Sub-ms look |      | - Off-route   |      |   LineStrings |
+---------------+      +---------------+      +---------------+      +---------------+
```

### Technology Matrix

| Layer | Technology | Role & Purpose |
| :--- | :--- | :--- |
| **Server Framework** | **Express.js 5 / Node.js 24** | Robust HTTP REST API layer with Helmet, CORS, and Zod validation |
| **Language** | **TypeScript 5+** | Full type safety across GeoJSON, OSRM responses, and Socket payloads |
| **Real-time Layer** | **Socket.IO 4+** | Bi-directional live driver tracking, HUD progress streaming, and instant reroute pushes |
| **Geospatial Database** | **MongoDB (Mongoose)** | Stores POIs (Places), historical routes, and tracking breadcrumbs with `2dsphere` indexes |
| **Routing Engine** | **OSRM** | Turn-by-turn navigation, waypoint optimization (TSP), map matching, and distance matrix |
| **Cache Layer** | **Redis (ioredis)** | Route query caching (TTL) + `GEOADD`/`GEOSEARCH` for high-throughput driver proximity |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** >= 18 (Node 24 tested)
- **MongoDB** (running locally or via Docker)
- **Redis** (running locally or via Docker)

### 2. Installation

```bash
# Clone and enter workspace
git clone <repo_url>
cd B-Map-Backend

# Install dependencies
npm install
```

### 3. Environment Setup

Create `.env` based on `.env.example`:

```env
PORT=4000
NODE_ENV=development
API_PREFIX=/api/v1
CORS_ORIGIN=*

# MongoDB Geospatial Database
MONGODB_URI=mongodb://localhost:27017/b_map_navigation

# Redis Cache & Real-Time Geo Layer
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=bmap:
REDIS_ROUTE_CACHE_TTL_SECONDS=3600

# OSRM Routing Engine
OSRM_BASE_URL=https://router.project-osrm.org
OSRM_DEFAULT_PROFILE=driving
OSRM_TIMEOUT_MS=8000

# Navigation Thresholds
OFF_ROUTE_THRESHOLD_METERS=40
REROUTE_COOLDOWN_SECONDS=5
```

### 4. Run Development Server

```bash
npm run dev
```

Server starts at: `http://localhost:4000`

### 5. Run with Docker Compose

Run MongoDB, Redis, and B-Map backend with a single command:

```bash
docker-compose up --build
```

---

## 📡 REST API Reference

> 📖 **Authoritative Exhaustive Reference**: For full schema definitions, request payloads, response contracts, and all 49 modular domains, see **[apiendpoint.md](file:///e:/B-Map-Backend/apiendpoint.md)**.

Base URL: `http://localhost:8080/api/v1` (or `http://localhost:4000/api/v1`)

### 1. Routing Engine (`/routes`)
- **`GET /routes/directions`**: Turn-by-turn route calculation (cached in Redis).
  - Query: `origin=lon,lat&destination=lon,lat&waypoints=lon,lat|...&profile=driving|bike|foot&alternatives=true`
- **`POST /routes/optimize`**: Traveling Salesperson Problem (TSP) multi-waypoint optimization.
  - Body: `{ "coordinates": [[13.38, 52.51], [13.39, 52.52], [13.40, 52.50]], "profile": "driving" }`
- **`POST /routes/match`**: Map matching GPS traces to the road network.
  - Body: `{ "coordinates": [[lon, lat], ...], "timestamps": [...] }`
- **`GET /routes/matrix`**: Distance & duration matrix across multiple points.
  - Query: `coordinates=lon1,lat1;lon2,lat2;lon3,lat3`

### 2. Places & POI Geospatial Search (`/places`)
- **`POST /places`**: Create a new Point of Interest.
  - Body: `{ "name": "Berlin Central Station", "category": "station", "coordinates": [13.369, 52.525], "tags": ["transit"] }`
- **`GET /places/nearby`**: Geospatial `$near` search with distance sorting.
  - Query: `longitude=13.38&latitude=52.51&maxDistance=3000&category=fuel`
- **`POST /places/within-polygon`**: Geospatial search inside bounding polygon via `$geoWithin`.
- **`GET /places/search`**: Keyword search with text regex indexing.
  - Query: `q=station&category=transit`
- **`GET /places/:id`**: Place details.

### 3. Turn-by-Turn Navigation Sessions (`/navigation`)
- **`POST /navigation/start`**: Start a navigation session.
  - Body: `{ "userId": "usr_1", "origin": [13.388, 52.517], "destination": [13.397, 52.529], "profile": "driving" }`
- **`POST /navigation/progress`**: Submit REST location update.
- **`GET /navigation/:sessionId`**: Get session status and metrics.
- **`POST /navigation/:sessionId/end`**: Conclude or cancel session.

### 4. Live Vehicle & Driver Tracking (`/tracking`)
- **`POST /tracking/update`**: Ingest live location into Redis geospatial index.
- **`GET /tracking/nearby`**: Query active drivers within radius using Redis `GEOSEARCH`.
  - Query: `longitude=13.38&latitude=52.51&radius=5000&role=driver`
- **`GET /tracking/:userId`**: Query current coordinates for a specific user.

### 5. High-Precision & Weak-Signal Positioning Engine (`/positioning`)
- **`POST /positioning/fuse`**: Ingest multi-sensor packet (GNSS + IMU + Odometry + Wi-Fi/BLE) and compute fused position with sub-meter precision.
- **`POST /positioning/anchors`**: Register a ground-truth BLE beacon or Wi-Fi anchor in an underground parking garage or tunnel.
- **`GET /positioning/anchors/nearby`**: Query registered anchors in a facility.
- **`POST /positioning/rtk/base-station`**: Register a CORS RTK base station.

### 6. Lane-Level Routing & "Veteran Driver" Layering (`/lane-routing`)
- **`POST /lane-routing/guidance`**: Real-time lane guidance HUD: evaluates current lane, time-dependent bus/HOV restrictions, and generates early lane change warnings.
- **`POST /lane-routing/plan`**: Plan routes with Veteran Driver personas (`veteran_fast`, `veteran_smooth`, `novice_friendly`, `commuter_smart`).
- **`POST /lane-routing/veteran/experience`**: Ingest crowdsourced driver experience reports, hazards, and local shortcut links.
- **`POST /lane-routing/segments`**: Register HD lane segments with directional constraints and transitions.

### 7. Unified Underlying Engine & Dynamic Recommendations (`/unified`)
- **`POST /unified/session/start`**: Initialize a full unified session binding positioning, routing, lane guidance, and recommendations.
- **`POST /unified/tick`**: Process a single unified telemetry tick (GNSS + IMU + Odo + Battery) through the unified underlying pipeline.
- **`POST /unified/recommendations/accept`**: Accept a dynamic recommendation (switch to faster route, add parking lot waypoint).
- **`POST /unified/recommendations/dismiss`**: Dismiss a recommendation.

### 8. AI-Powered Data Production & Big-Data POI Mining (`/data-mining`)
- **`POST /data-mining/trajectories/mine-staypoints`**: ST-DBSCAN stay-point extraction, hotspot discovery, and curbside PUDO entrance mining.
- **`POST /data-mining/poi/resolve`**: Entity resolution, Jaccard/geospatial deduplication, and Master Golden Record fusion.
- **`POST /data-mining/road-production/detect-new-roads`**: Automated new road centerline extraction from trajectory clusters.
- **`POST /data-mining/road-production/detect-closure`**: Zero-flow road closure anomaly detection.
- **`GET /data-mining/road-production/changes`**: List AI-detected road network changes.

### 9. Lane-Level Guidance (SR Navigation) (`/sr-navigation`)
- **`POST /sr-navigation/hud-state`**: Compute sub-meter lateral offset, boundary clearances, Lane Departure Warning (LDW), forward collision warning (FCW), cut-in alerts, and 3D Junction Cards with overhead gantries.
- **`POST /sr-navigation/roads`**: Register high-definition 3D lane boundaries and asphalt markings.
- **`GET /sr-navigation/roads/:segmentId`**: Retrieve HD road model.

### 10. Automotive & Ecosystem Integration (`/automotive`)
- **`POST /automotive/carplay/template`**: Generate Apple CarPlay `CPNavigationTemplate` with maneuver variants, color scheme, and voice prompts.
- **`POST /automotive/android-auto/template`**: Generate Android Auto `NavigationTemplate` for Android for Cars App Library.
- **`POST /automotive/aaos/properties`**: Ingest native Android Automotive OS (AAOS) VHAL `CarPropertyManager` properties (speed, gear, turn signal, battery).
- **`POST /automotive/telemetry/can`**: Stream high-frequency CAN Bus / OBD-II frames and compute real-time Eco-Driving score (0-100) and efficiency coaching.
- **`POST /automotive/ev/plan`**: Smart EV route planning with battery consumption model, DC fast charging station insertion, and automated battery thermal pre-conditioning.
- **`POST /automotive/hud/frame`**: Ultra-compact 8-byte optical waveguide HUD binary hex payload generation.

### 11. Rider Mode (Motorcycle & Two-Wheeler) (`/rider-mode`)
- **`POST /rider-mode/route/plan`**: Specialized two-wheeler routing respecting expressway bans, toll avoidance, dedicated motorcycle lanes, and narrow passable alleys.
- **`POST /rider-mode/dynamics`**: Ingest IMU roll/pitch/yaw dynamics; compute real-time lean angle, safe cornering speed advisory, and riding smoothness.
- **`POST /rider-mode/weather-safety`**: Evaluate two-wheeler crosswind warnings on bridges (>35 km/h), wet slick surface advisories, and black ice hazards.
- **`POST /rider-mode/helmet/cue`**: Generate ultra-concise Bluetooth audio cues with 75% audio ducking for intercom chat.
- **`GET /rider-mode/glove-ui`**: Oversized 4-button glove-friendly touchscreen layout or handlebar remote switch configuration.
- **`POST /rider-mode/crash/detect`**: Autonomous motorcycle fall / crash detection (e-Call) with impact G-force (>3.8g), high tilt (>65°), zero velocity, and rider SOS dispatch.
- **`POST /rider-mode/crash/cancel/:eventId`**: Manually cancel e-Call when rider confirms "I am OK".
- **`GET /rider-mode/hazards/nearby`**: Query nearby two-wheeler hazards (tram tracks, metal bridge joints, loose gravel).
- **`POST /rider-mode/hazards/report`**: Report crowdsourced rider hazards.

### 12. Parking Space-Level Navigation (`/parking`)
- **`POST /parking/entrance/detect`**: Detect vehicle crossing facility geofence / entry barrier for seamless outdoor-to-indoor navigation transition.
- **`GET /parking/facilities/:facilityId`**: Get multi-floor underground facility details, ramps, elevators, and gate coordinates.
- **`GET /parking/facilities/:facilityId/bays`**: Query bays filtered by floor level, EV charger (kW & plug type), vacancy, and walking distance to elevator.
- **`POST /parking/indoor/plan`**: Plan indoor A* turn-by-turn guidance from entrance gate down ramps directly into designated parking bay.
- **`POST /parking/find-my-car`**: Reverse pedestrian walking route from shopping mall elevator back to parked vehicle.
- **`POST /parking/reserve`**: 30-minute digital space reservation with PIN code.
- **`POST /parking/check-in`**: Confirm arrival and begin parking billing session.
- **`POST /parking/check-out`**: Conclude session and calculate parking fees.

### 13. Multi-Mode: Car Navigation (`/car-nav`)
- **`POST /car-nav/plan`**: Multi-strategy car routing (`fastest`, `shortest`, `avoid_tolls`, `avoid_highways`, `eco_friendly`, `avoid_congestion`, `scenic`) with alternative route comparison matrix (duration delta, tolls, fuel/kWh consumption, traffic lights count).
- **`POST /car-nav/optimize-stops`**: Multi-stop sequence optimizer (TSP with arrival time estimates).
- **`GET /car-nav/cameras/nearby`**: Query speed enforcement, red-light, and average speed section control cameras.

### 14. Multi-Mode: Public Transit Mastery (`/transit`)
- **`POST /transit/itinerary`**: Multimodal trip planner (Subway, Commuter Rail, Tram, Bus) with walking legs, optimal train carriage boarding advice, station exit gate recommendations, and fare advice.
- **`GET /transit/stations/:stationId/departures`**: Real-time station departure board with delays, track/platform numbers, crowding levels, and live vehicle IDs.
- **`GET /transit/stations/nearby`**: Discover nearby transit stations and interchanges.

### 15. Multi-Mode: Augmented Reality (AR) Walk/Cycle Navigation (`/ar-walk-cycle`)
- **`POST /ar-walk-cycle/ar/hud-frame`**: Real-time AR 3D world anchors projected onto device camera viewport coordinates (`screenX%`, `screenY%`, depth distance, perspective scale) with zebra crosswalk entrance alerts.
- **`POST /ar-walk-cycle/walk/plan`**: Accessible pedestrian walking (wheelchair/stroller, no stairs, curb ramps) & weather-sheltered covered arcade routing.
- **`POST /ar-walk-cycle/cycle/plan`**: Cycle routing with elevation profile (total ascent/descent, slope %), steep incline warnings, calories burned, and en-route bicycle amenities.
- **`GET /ar-walk-cycle/cycle/amenities`**: Nearby bike repair stands, free air pumps, e-bike smart chargers, and bike share stations.

### 16. Comprehensive AI & Large Language Model (LLM) Features (`/ai-copilot`)
- **`POST /ai-copilot/chat`**: In-drive conversational AI copilot with multi-turn session persistence, vehicle context awareness (speed, battery/fuel, remaining distance), and agentic tool dispatching (`search_pois_along_route`, `reroute_traffic_avoidance`, `find_fatigue_rest_stop`, `query_smart_parking_bay`, `adjust_nav_control`).
  - Body: `{ "conversationId": "conv_123", "prompt": "Find a coffee shop along route", "vehicleContext": { "currentSpeedKmh": 65, "batteryLevelPct": 45 } }`
- **`GET /ai-copilot/sessions/:conversationId`**: Retrieve multi-turn conversation history and dialogue context.
- **`POST /ai-copilot/vision/analyze`**: Multimodal Vision AI dashcam / street camera frame analyzer. Detects road hazards (potholes, debris, flooding, construction barricades), reads traffic signs (OCR speed limits & warnings), and estimates parking occupancy.
  - Body: `{ "imageUrl": "https://...", "location": [13.388, 52.517], "heading": 180, "captureTimestamp": "2026-10-09T16:30:00Z" }`
- **`POST /ai-copilot/traffic/forecast`**: Spatio-temporal AI predictive travel time forecaster and departure slot optimizer. Analyzes cyclical rush-hour harmonics and predicts bottleneck probability.
  - Body: `{ "origin": [13.389, 52.517], "destination": [13.320, 52.502], "targetDepartureTime": "2026-10-10T08:00:00Z" }`
- **`POST /ai-copilot/poi/intelligence`**: POI review intelligence and destination arrival briefing generator. Synthesizes sentiment (0-100), highlights pros/cons, best parking advice, and in-car audio arrival briefings.
  - Body: `{ "poiId": "poi_potsdamer_mall", "name": "Potsdamer Platz Hub", "category": "shopping_mall" }`

### 17. Health Check (`/health`)
- **`GET /health`**: Returns real-time connectivity status of MongoDB, Redis, and OSRM.

### 18. Indian Sovereign NavIC & Satellite Positioning (`/navic`)
- **`POST /navic/fix`**: Process NavIC (IRNSS) dual-frequency (L5 + S-band) and GAGAN augmented GNSS fix.
- **`GET /navic/constellation`**: Real-time orbital status and SNR telemetry of NavIC (IRNSS-1A through 1J) and GAGAN satellites.

### 19. FASTag Electronic Toll Collection (`/tolls`)
- **`POST /tolls/calculate`**: Route-based electronic toll calculation with return trip logic and two-wheeler exemption.
- **`GET /tolls/nearby`**: Query nearby NHAI/State expressway toll plazas with single/return/monthly tariffs.

### 20. PINCode Postal Registry & Indian Address Parser (`/pincode`)
- **`GET /pincode/:pincode`**: Official 6-digit Indian PIN code lookup with post office, district, state, and coordinates.
- **`POST /pincode/parse-address`**: Entity extraction parsing unformatted Indian address strings into structured components.
- **`GET /pincode/reverse`**: Reverse geocoding latitude/longitude coordinates to nearest postal PIN code.

### 21. DIGIPIN National Digital Address Micro-Grid (`/digipin`)
- **`GET /digipin/encode`**: Encode latitude/longitude into standard 4m x 4m National DIGIPIN micro-grid code.
- **`GET /digipin/decode/:code`**: Decode DIGIPIN code into geographical centroid coordinates and bounding box.

### 22. Emergency SOS Dispatch & Facility Locator (`/emergency`)
- **`POST /emergency/sos`**: Trigger emergency SOS alert with automated dispatch to national helplines (112, NHAI 1033).
- **`GET /emergency/facilities/nearby`**: Locate nearby trauma centers, highway patrol units, police stations, and towing services.

### 23. Environmental Intelligence: AQI, Solar & Pollen (`/environment`)
- **`GET /environment/air-quality`**: Real-time CPCB Air Quality Index (AQI), PM2.5, PM10, and health advisories.
- **`GET /environment/solar`**: Rooftop solar photovoltaic potential, annual sunshine hours, and carbon offset.
- **`GET /environment/pollen`**: Tree, grass, and weed pollen index levels with allergy summaries.

### 24. Highway Weather & IMD Radar Overrides (`/weather`)
- **`GET /weather/highway`**: Expressway weather conditions with winter fog advisories and IMD color alert levels.
- **`POST /weather/override`**: Inject manual weather overrides (e.g. dense fog, heavy rain) for highway stretches.
- **`GET /weather/overrides`**: List active manual weather overrides.
- **`DELETE /weather/override/:name`**: Remove manual weather override by highway name.

### 25. Crowdsourced Road Hazards & Potholes (`/hazards`)
- **`GET /hazards/ahead`**: Lookahead query for unmarked speed breakers, potholes, waterlogging, and stray cattle.
- **`POST /hazards/report`**: Crowdsource hazard reports with severity grading and voice advisory triggers.

### 26. Vernacular Audio Voice Prompts (`/vernacular`)
- **`POST /vernacular/prompt`**: Generate localized turn-by-turn audio prompts in 10+ Indian languages (Hindi, Bengali, Tamil, Telugu, Kannada, Marathi, Gujarati, Malayalam, Punjabi, Indian English).
- **`GET /vernacular/languages`**: List supported Indian vernacular languages with native script metadata.

### 27. V2X SPaT & GLOSA Speed Advisory (`/v2x`)
- **`GET /v2x/signals/nearby`**: Query connected municipal smart traffic lights with live SPaT status.
- **`GET /v2x/signals/:id`**: Query specific signal phase timing, current phase, and countdown seconds.
- **`POST /v2x/glosa/advisory`**: Calculate Green Light Optimal Speed Advisory (GLOSA) to ride the green wave without stopping.

### 28. Differential Privacy & Coordinate Obfuscation (`/obfuscation`)
- **`POST /obfuscation/transform`**: Coordinate datum transformations between WGS84, GCJ02, and BD09.
- **`POST /obfuscation/fuzz`**: Planar Geo-Indistinguishability Laplace noise injection for privacy-preserving telemetry.

### 29. Survey of India (SOI) Territorial Boundaries (`/boundaries`)
- **`GET /boundaries/territorial`**: Official SOI-mandated territorial boundary LineString for National Geospatial Policy compliance.
- **`GET /boundaries/region-highlight`**: Sovereign boundary polygon highlight with inverted world dimming mask.

### 30. Electric Vehicle (EV) Charging Network (`/ev`)
- **`GET /ev/stations`**: Locate nearby EV fast-chargers filtered by connector type (CCS2, Type 2, Ather Grid, Bharat AC001).
- **`GET /ev/stations/:id`**: Real-time port availability, charging speeds (kW), pricing, and amenities.

### 31. Municipal City Fares (`/fares`)
- **`POST /fares/estimate`**: Official RTO metered auto-rickshaw, kaali-peeli taxi, and cab fare estimation with night surcharges.

### 32. Roads API (`/roads`)
- **`POST /roads/snap-to-roads`**: Snap raw GPS trajectory points to the road geometry with interpolation.
- **`GET /roads/speed-limits`**: Query posted speed limits for road segments.

### 33. Dynamic Maps & Vector Tiles (`/maps` & `/tiles`)
- **`GET /maps/style.json`**: MapLibre/Mapbox-compatible vector tile style specification across themes.
- **`GET /maps/static`**: Server-rendered lightweight SVG static map generator with path and markers.
- **`GET /maps/clusters`**: Server-side geospatial POI clustering with zoom-dependent expansion.
- **`GET /tiles/:z/:x/:y`**: Dynamic vector tile serving in GeoJSON/MVT format.

### 34. Fleet Telemetry & Ride Dispatch (`/fleet`)
- **`POST /fleet/location`**: Real-time driver telemetry ingestion with heading and speed.
- **`GET /fleet/nearby`**: Discover online drivers within geographical radius.
- **`POST /fleet/trips/request`**: Request and dispatch commercial fleet trips with automated fare estimation.

### 35. Geospatial Timezone Engine (`/timezone`)
- **`GET /timezone`**: High-performance coordinate-to-timezone resolution (IST Asia/Kolkata, GMT, etc.).

### 36. User Ratings & Feedback Feed (`/ratings`)
- **`POST /ratings`**: Submit 1-5 star user rating and review comments.
- **`GET /ratings/my-rating`**: Retrieve current user's rating profile.
- **`GET /ratings/stats`**: Aggregated rating distribution and average score.
- **`GET /ratings`**: Public feed of ratings and reviews.

### 37. Admin Command Center & Control Portal (`/admin`)
- **`GET /admin/dashboard`**: Interactive dark-mode glassmorphic Web Portal for monitoring and administering the entire B-Map ecosystem. (Also accessible via `/admin` redirect).
- **`GET /admin/overview`**: Consolidated executive metrics (users, active sessions, ratings, advisories, Redis/Mongo status).
- **`GET /admin/analytics/users`**: Active user and daily/weekly sign-up trends.
- **`GET /admin/analytics/feature-usage`**: Feature telemetry usage metrics across routing, tolls, NavIC, weather, and SOS.
- **`GET /admin/users`**: Searchable, paginated user directory with role and verification filters.
- **`POST /admin/users`**: Direct administrative user creation with pre-verified status and role options.
- **`GET /admin/users/:id`**: Detailed profile for a specific user.
- **`PATCH /admin/users/:id`**: Update user profile, promote to `admin`, or modify verification status.
- **`DELETE /admin/users/:id`**: Delete a user profile (with root administrator deletion safeguards).
- **`GET /admin/users/stats`**: Summary counts of total, verified, unverified, and administrative users.
- **`GET /admin/users/active`**: Active online users list.
- **`GET /admin/system/health`**: Comprehensive health telemetry covering MongoDB, Redis, OSRM base URL, CPU, memory, and Socket.IO connections.
- **`GET /admin/system/cache`**: Redis cache statistics and key counts.
- **`POST /admin/system/cache/flush`**: Invalidate cached routing keys (`routes`) or clear all cache (`all`).
- **`GET /admin/system/config`**: Dynamic sovereign feature flags (NavIC, AI Copilot, Lane Guidance, Maintenance Mode).
- **`PATCH /admin/system/config`**: Update dynamic system configuration and feature flags without restarting server.
- **`GET /admin/traffic/overrides`**: List active road segment traffic congestion and speed multiplier overrides.
- **`POST /admin/traffic/override`**: Inject real-time road segment traffic speed multipliers and congestion flags.
- **`DELETE /admin/traffic/override/:id`**: Remove traffic override.
- **`GET /admin/weather/overrides`**: List active expressway weather and winter fog advisories.
- **`POST /admin/weather/override`**: Inject manual weather overrides (e.g. dense fog, heavy rain) for highway stretches.
- **`DELETE /admin/weather/override/:name`**: Remove manual weather override by highway name.
- **`GET /admin/hazards`**: List reported road hazards (speed breakers, potholes, waterlogging).
- **`POST /admin/hazards`**: Broadcast official road hazard alert.
- **`PATCH /admin/hazards/:id/verify`**: Confirm and verify crowdsourced road hazard reports.
- **`DELETE /admin/hazards/:id`**: Remove / resolve road hazard.
- **`GET /admin/tolls`**: List all registered toll plazas with highway and operator filter.
- **`POST /admin/tolls`**: Register new toll plaza in the electronic toll registry.
- **`PATCH /admin/tolls/:id`**: Update toll rates (single, return, monthly) and FASTag operational status.
- **`DELETE /admin/tolls/:id`**: Remove toll plaza from registry.
- **`GET /admin/places`**: Paginated search across master Points of Interest (POIs).
- **`POST /admin/places`**: Create official POI with GeoJSON coordinates.
- **`DELETE /admin/places/:id`**: Remove POI.
- **`GET /admin/emergency/incidents`**: Real-time log of Highway Emergency SOS alerts.
- **`PATCH /admin/emergency/incidents/:id`**: Update emergency incident status (`ACKNOWLEDGED`, `DISPATCHED`, `RESOLVED`).
- **`GET /admin/ratings`**: Moderation feed of user ratings and reviews.
- **`DELETE /admin/ratings/:id`**: Remove inappropriate or spam user review.
- **`GET /admin/audit-logs`**: Compliance audit trail recording administrative actions, timestamps, and actor details.

### 38. High-Throughput Telemetry Ingestion, Fraud Detection & Async Queue (`/telemetry` & `/telemetry-ingest`)
- **`POST /telemetry/ingest`**: High-throughput telematics ingestion (single event, array, or batch envelope) supporting ~120 dynamic hardware/IMU/battery metrics, Gzip decompression, and sub-10ms async queue enqueuing returning HTTP 202 Accepted.
- **`POST /telemetry/batch`**: Dedicated mobile client buffered batch ingestion flushed every 30-60s with batch-level idempotency deduplication.
- **`POST /telemetry/heartbeat`**: Lightweight periodic keepalive heartbeat ingestion.
- **`GET /telemetry/stats`**: Operational telemetry statistics (queue depth, consumer throughput, fraud detection rate, session open/stop rate).
- **`GET /telemetry/logs`**: Paginated query interface for stored telemetry events with device, session, and fraud-detection filters.

### 39. Real-Time Crowdsourced Traffic & Dynamic ETAs (`/traffic`)
- **`POST /traffic/telemetry`**: Ingests anonymized velocity vectors, computes segment harmonic mean speeds, and dynamically re-weights road network edges.
- **`POST /traffic/eta`**: Computes turn-by-turn dynamic ETA weighted by travel times strictly in **minutes (not kilometers)** and signal cycle delays.
- **`POST /traffic/evaluate-anomaly`**: Multi-device DBSCAN clustering and tea-stall outlier filter ($\ge 3$ vehicles required to confirm congestion).
- **`GET /traffic/graph`**: Directed road network graph topology with intersection wait times.
- **`GET /traffic/segments`**: Live road segments with BPR congestion levels (`free_flow`, `slow`, `congested`, `severe_gridlock`).
- **`GET /traffic/predict`**: Blends live telemetry with historical speed distributions across 15-minute time windows.
- **`GET /traffic/shockwave/:segmentId`**: Macroscopic LWR shockwave velocity ($w = \Delta q / \Delta k$) and junction spillback prediction.
- **`POST /traffic/eco`**: Physics-based multi-powertrain energy consumption comparison (Petrol, Diesel, EV with regenerative braking).
- **`POST /traffic/security/anti-spoofing`**: Kinematic plausibility engine blocking GPS teleportation and impossible acceleration ($a > 6.5\text{ m/s}^2$).
- **`POST /traffic/security/proof-of-presence`**: Issues tamper-proof HMAC-SHA256 signed Proof-of-Presence certificate.
- **`POST /traffic/security/proof-of-presence/verify`**: Verifies Proof-of-Presence certificates against public key registry.

### 40. App Version Governance & Dynamic OTA Patching (`/app-version` & `/version`)
- **`GET /app-version/current`**: Authoritative sovereign release version (1.0.0).
- **`GET /app-version/latest`**: Latest version specifications across client platforms (`web`, `android`, `ios`, `desktop`).
- **`GET /app-version/check` / `POST /app-version/check`**: Evaluates installed client version against minimum required release and available OTA bundles.
- **`PATCH /app-version/patch`**: Dynamically mutates client release version, release notes, and OTA JavaScript bundle URLs with real-time WebSocket broadcast.
- **`POST /app-version/broadcast`**: Manually triggers real-time WebSocket update push across connected frontends.

---

## 🧠 Comprehensive AI & Large Language Model (LLM) Suite

### 1. In-Drive Conversational Copilot & Voice Agent
- **Multi-Turn Context & Intent Classifier**: Classifies driver requests into explicit spatial intents (`FIND_ALONG_ROUTE`, `REROUTE_TRAFFIC_WEATHER`, `FATIGUE_REST_ASSIST`, `QUERY_PARKING_LAST_METER`, `NAV_CONTROL`, `POI_DETAILS_INQUIRY`, `GENERAL_TRAVEL_QNA`) with confidence calibration.
- **Agentic Tool Execution**:
  - `search_pois_along_route`: Evaluates minimal detour duration and distance off active route.
  - `reroute_traffic_avoidance`: Calculates alternative bypasses saving $\ge 5$ minutes.
  - `find_fatigue_rest_stop`: Recommends rest stops when continuous drive $> 2$ hours.
  - `query_smart_parking_bay`: Queries multi-floor facility vacancies, EV charging plugs, and reserves bays.
  - `adjust_nav_control`: Mutes voice guidance, changes 2D/3D perspective, or toggles HUD layers.
- **In-Drive Safety Constraints**: Returns max 3 concise quick-suggestion chips to minimize driver cognitive load.

### 2. Multimodal Vision AI & Road Hazard Analyzer
- **Road Surface Defect & Hazard Detection**: Identifies potholes, debris, standing water/flooding, and construction channelizers with bounding boxes and severity grading (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- **Traffic Sign Recognition & OCR**: Reads temporary speed limits, work zone warnings, and no-entry signs directly from forward-facing dashcam frames.
- **Curbside & Parking Lot Occupancy**: Estimates parking lot fullness and vacant bay counts from aerial or gate camera frames.
- **Spatial Incident Logging**: Ingests detections into MongoDB with geospatial `2dsphere` indexes to crowdsource live hazard warnings for following vehicles.

### 3. AI Predictive Traffic & Spatio-Temporal Forecaster
- **Harmonic Rush-Hour Travel Time Modeling**: Combines free-flow travel times with historical cyclical rush-hour surge curves and peak congestion coefficients.
- **Spatio-Temporal Departure Windows**: Computes travel duration and jam probability across multiple departure slots (e.g. -15m, target, +20m, +45m) and recommends the optimal departure time.
- **Bottleneck Anomaly Identification**: Flags critical choke points, anticipated delay minutes, and recommended alternate arterials.

### 4. AI POI Intelligence & Arrival Audio Briefings
- **Review Sentiment & Aspect Extraction**: Analyzes crowdsourced reviews to derive sentiment score (0–100), key pros and cons, peak crowd hours, and parking difficulty.
- **In-Car Arrival Audio Briefings**: Generates natural speech scripts preparing drivers for parking barrier locations, elevator access, and nearest EV charging bays upon approaching destination.

---

## 🤖 AI-Powered Data Production & Big-Data POI Mining

### 1. Spatio-Temporal Trajectory Mining (ST-DBSCAN)
- **Dwell / Stay-Point Extraction**: Filters low-speed ($v < 1.2\text{ m/s}$) stops lasting $\ge 5$ minutes to identify human activities.
- **Cluster Category Inference**: Infers business types (`fuel`, `restaurant`, `shopping`, `workplace`) from dwell duration distributions and peak hours.
- **PUDO & Entrance Discovery**: Mines short vehicle stops (45s–180s) along curbs to pinpoint building and parking entrances.

### 2. POI Entity Resolution & Golden Record Fusion
- **Multi-Attribute Hybrid Similarity**: Fuses Jaccard token overlap, substring containment, and geospatial decay ($S_{\text{geo}} = 1 - d/100$) to match multi-source duplicates.
- **Master Golden Records**: Merges aliases, binds multi-modal entrances, computes 30-day footfall, and tracks business vitality and closure risk.

### 3. Automated Road Centerline Extraction & Change Detection
- **Unmapped Road Discovery**: Groups unmapped trajectory trails and fits smoothed GeoJSON `LineString` centerlines with confidence scoring.
- **Closure Anomaly Detection**: Flags blocked roads based on zero vehicle flow during expected peak traffic periods.

---

## ⚡ Unified Underlying Engine & Dynamic Recommendations

### 1. Unified Navigation Lifecycle Pipeline
- Ingests high-frequency sensor ticks (10Hz–50Hz) and coordinates the entire stack in sub-10ms:
  1. **Sensor Fusion**: RTK / EKF / Dead Reckoning high-precision position.
  2. **Active Route Progress**: Distance to destination, ETA, off-route detection, and dynamic rerouting.
  3. **Lane-Level Real-Time Guidance**: Matches vehicle's current lane index to recommended maneuver lanes.
  4. **Context-Aware Dynamic Recommendations**: Evaluates arrival envelope, traffic deltas, energy reserves, and driver fatigue.

### 2. Context-Aware Dynamic Recommendations
- **Faster Route Advisor**: Periodically probes alternative routes; recommends switch if $\ge 3$ minutes are saved.
- **Destination Parking Recommender**: Triggers within 2km of arrival; recommends nearest parking garage with walking distance to destination and real-time open bay counts.
- **Low-Energy Replenishment**: Triggers when battery/fuel $< 20\%$; finds optimal charging hub directly along route with minimal detour duration.
- **Fatigue Break Monitor**: Proactively suggests rest areas after 2 hours of continuous driving.

---

## 🛣️ Lane-Level Routing & "Veteran Driver" Layering

### 1. HD Lane-Level Guidance & Early Warning
- **Per-Lane Direction Modeling**: Identifies straight, turn-left, turn-right, and compound lanes.
- **Dynamic Time Restrictions**: Prohibits Bus/HOV/Tidal lanes during specified peak hours (e.g. Mon-Fri 07:00-09:00).
- **Proactive Multi-Lane Change Prompts**: Calculates required transition distance based on vehicle speed ($v$) and number of lanes to cross, issuing `early_notice`, `recommended`, `urgent`, or `critical` alerts.

### 2. "Veteran Driver" Experience Layer (老司机经验图层)
- **Crowdsourced Habit Mining**: Injects speed efficiency multipliers and historical pace ratios onto links to bypass known signal traps and bottleneck intersections.
- **Routing Personas**:
  - `veteran_fast`: Exploits proven local arterial shortcuts to bypass gridlock.
  - `veteran_smooth`: Avoids potholes, awkward merges, and illegal parking bottlenecks.
  - `novice_friendly`: Shields beginner drivers from high-stress 6-lane unprotected left turns and narrow blind-corner alleyways.
  - `commuter_smart`: Adapts to learned daily commute schedules.

---

## 🛰️ High-Precision & Weak-Signal Positioning Engine

### Algorithmic Capabilities
1. **Extended Kalman Filter (EKF) Sensor Fusion**:
   - 6-state vector $[x, y, v_x, v_y, \theta, b_g]$ fusing IMU (accelerometer + gyro) with GNSS observations.
   - Non-Holonomic Constraints (NHC) preventing lateral slippage ($v_{\text{lat}} \approx 0$).
   - Dynamic innovation gating to reject multipath spikes in urban canyons.
2. **RTK / DGNSS Differential Correction Engine**:
   - Carrier phase ambiguity resolution emulation with baseline vector computation.
   - Decimeter-level RTK Float (< 0.5m) and centimeter-level RTK Fixed (< 0.05m).
   - Real-time **Lane-Level Resolution** mapping vehicle offset to exact highway lanes (e.g. Lane 0, Lane 1, HOV).
3. **Zero-Jump Dead Reckoning (VDR & PDR)**:
   - Activates instantly upon GNSS blackout (tunnels, indoor ramps).
   - Heading integration via gyroscope yaw-rate with stationary bias calibration (ZUPT).
   - Longitudinal speed integration with uncertainty growth modeling.
4. **Weak-Signal BLE / Wi-Fi Trilateration Engine**:
   - Log-Distance Path Loss model: $d = 10^{\frac{\text{TxPower} - \text{RSSI}}{10 \cdot n}}$.
   - Weighted Centroid Localization (WCL) for underground parking garages and multi-floor facilities.
   - MongoDB `2dsphere` facility anchor registry (`BeaconAnchorModel`).

---

## 🔌 Socket.IO Real-Time Protocol

WebSocket Endpoint: `ws://localhost:4000`

### Real-Time Positioning & Telemetry Stream
| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `positioning:telemetry` | Client -> Server | `RawSensorPacket` (GNSS + IMU + Odo + Beacons) | High-frequency telemetry stream (10Hz-50Hz) |
| `positioning:fused_state`| Server -> Client | `FusedPositionState` | Sub-meter fused position, environment, lane index, confidence |
| `positioning:subscribe` | Client -> Server | `{ targetDeviceId }` | Subscribes to live HUD or fleet vehicle stream |

### Driver / Vehicle Location Streaming
| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `location:update` | Client -> Server | `{ userId, longitude, latitude, heading, speed, role }` | Ingests GPS point into Redis `GEOADD` and broadcasts |
| `location:broadcast` | Server -> Client | Telemetry payload | Broadcast to subscribed clients |
| `location:subscribe` | Client -> Server | `{ targetUserId }` | Subscribes to live location of driver |
| `nearby:drivers:request` | Client -> Server | `{ longitude, latitude, radiusInMeters }` | Queries nearby drivers over socket |
| `nearby:drivers:response`| Server -> Client | `{ count, results: [...] }` | Real-time list of nearby drivers with distance |

### Turn-by-Turn Navigation Session Events
| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `nav:join` | Client -> Server | `{ sessionId }` | Joins the navigation session room |
| `nav:update_progress` | Client -> Server | `{ sessionId, currentLocation: [lon, lat], heading, speed }` | Streams continuous GPS progress |
| `nav:progress_state` | Server -> Client | `{ currentStep, remainingDistanceMeters, remainingDurationSeconds, distanceToNextStepMeters }` | HUD updates |
| `nav:off_route_alert` | Server -> Client | `{ distanceFromRouteMeters, timestamp }` | Triggered when vehicle deviates > threshold |
| `nav:reroute_success` | Server -> Client | `{ newRoute, distanceFromRouteMeters }` | Automatically sends newly recalculated OSRM route |
| `nav:destination_reached` | Server -> Client | `{ message, completedAt }` | Triggered when within arrival radius (< 25m) |

### Next-Gen Intelligent Driving & Lane-Level Events
| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `sr:telemetry_stream` | Client -> Server | `SRTelemetryPayload` | Streams sub-meter coordinates, lateral offset & objects |
| `sr:hud_broadcast` | Server -> Client | `SRNavigationHUDState` | Broadcasts 3D photorealistic HUD, lane matrix & gantries |
| `sr:lane_drift_alert` | Server -> Client | `{ direction, lateralOffsetMeters, message }` | Lane Departure Warning (LDW) when unblinker drift occurs |
| `sr:collision_warning` | Server -> Client | `{ level, message }` | Forward Collision Warning (FCW) when TTC is critical |
| `auto:can_stream` | Client -> Server | `CANBusTelemetryPacket` | Streams high-frequency CAN frames / OBD-II PID telemetry |
| `auto:eco_score_broadcast`| Server -> Client | `EcoDrivingScore` | Real-time 0-100 score, fuel savings, and eco coaching |
| `auto:hud_frame_stream` | Bi-directional | `SmartHUDFrame` | Serializes compact 8-byte binary frame for optical HUDs |
| `rider:dynamics_stream` | Client -> Server | `RiderDynamicsTelemetry` | Streams roll angle, yaw rate, lateral acceleration & IMU |
| `rider:lean_broadcast` | Server -> Client | `RiderLeanStats` | Returns max lean angles, traction limit & cornering speed |
| `rider:crash_alert` | Server -> Client | `RiderCrashEvent` | Autonomous fall/crash detection e-Call dispatch |
| `rider:crash_cancel` | Client -> Server | `{ eventId }` | Rider cancels emergency dispatch ("I am OK") |
| `parking:entrance_detect`| Client -> Server | `{ coordinates }` | Checks outdoor-to-indoor transition at facility gate |
| `parking:indoor_guidance` | Client -> Server | `{ facilityId, targetBayId }` | Streams indoor A* ramp and aisle guidance to spot |

### Comprehensive AI & LLM Copilot Events
| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `copilot:message_stream` | Client -> Server | `{ conversationId, prompt, vehicleContext }` | Live in-drive voice query or driver instruction |
| `copilot:message_response`| Server -> Client | `AICopilotResponse` | Assistant response, tool execution, HUD action & suggestions |

---

## 🧪 Simulation & Testing

Run the verification suites to test routing, sensor fusion, and intelligent driving:

```bash
# 1. Routing & Geo calculation simulation
npx tsx scripts/test-simulation.ts

# 2. High-Precision RTK & Weak-Signal Positioning simulation
npx tsx scripts/test-positioning-engine.ts

# 3. Lane-Level Routing & "Veteran Driver" Layer simulation
npx tsx scripts/test-lane-veteran-routing.ts

# 4. Unified Underlying Engine & Dynamic Recommendations simulation
npx tsx scripts/test-unified-engine.ts

# 5. AI-Powered Data Production & Big-Data POI Mining simulation
npx tsx scripts/test-ai-data-mining.ts

# 6. Next-Gen Intelligent Driving & Lane-Level Navigation simulation (4 Pillars)
npx tsx scripts/test-nextgen-driving-navigation.ts

# 7. Multi-Mode Core Navigation (Car, Transit, AR Walk/Cycle) simulation
npx tsx scripts/test-multi-mode-navigation.ts

# 8. Comprehensive AI & Large Language Model (LLM) Features simulation (4 Pillars)
npx tsx scripts/test-ai-copilot-engine.ts

# 9. Advanced Visualization & Spatial Mapping simulation (6 Pillars)
npx tsx scripts/test-spatial-visualization.ts

# 10. 4D Dynamic Space Rendering & High-Precision Indoor View simulation (6 Pillars)
npx tsx scripts/test-4d-space-and-indoor-view.ts

# 11. Unified Lifestyle & Commercial Super-App Ecosystem simulation (3 Pillars)
npx tsx scripts/test-super-app-ecosystem.ts
```

### 📱 Unified Lifestyle & Commercial Super-App Ecosystem API Reference

#### 1. All-in-One Ride-Hailing Platform
- `POST /api/v1/super-app/rides/quote`: Calculate real-time fare quotes across all vehicle categories (Auto-Rickshaw, Bike Taxi, Mini Hatchback, Prime Sedan, Green EV, SUV XL, Outstation Intercity) with surge pricing and municipal night tariffs.
- `GET /api/v1/super-app/rides/drivers/nearby`: Discover active nearby drivers within radius with real-time ETAs and driver ratings.
- `POST /api/v1/super-app/rides/request`: Request a ride, match driver, allocate 4-digit start OTP, and initialize trip lifecycle.
- `GET /api/v1/super-app/rides/:bookingId`: Retrieve live ride tracking status, assigned driver details, vehicle registration, and ETA.
- `POST /api/v1/super-app/rides/:bookingId/verify-otp`: Secure 4-digit OTP verification starting the trip (`in_transit`).
- `POST /api/v1/super-app/rides/:bookingId/complete`: Finalize trip, calculate distance, and settle digital invoice.
- `POST /api/v1/super-app/rides/:bookingId/cancel`: Cancel ride with grace-period validation and cancellation fee determination.

#### 2. POI Discovery & Lifestyle Booking Engine
- `GET /api/v1/super-app/lifestyle/places`: Contextual lifestyle search with dietary tags (`Pure Veg`, `Jain Available`, `Halal`), price tiers (`₹` to `₹₹₹₹`), ratings, and proximity radius.
- `GET /api/v1/super-app/lifestyle/places/:poiId`: Detailed lifestyle venue profile, menus, service catalog, photos, and available booking slots.
- `POST /api/v1/super-app/lifestyle/book`: Create instant dining table reservations or wellness spa/salon appointments with QR confirmation vouchers (`BMAP-XXXXXX`).
- `GET /api/v1/super-app/lifestyle/bookings/:bookingId`: Retrieve booking details and confirmation voucher.
- `POST /api/v1/super-app/lifestyle/bookings/:bookingId/cancel`: Cancel reservation with automatic deposit refund handling.

#### 3. Offline Maps Utilities & Storage Optimization
- `GET /api/v1/super-app/offline/bundles`: Catalog of pre-packaged regional offline map bundles (Delhi NCR, Mumbai MMR, Bengaluru, Himalayan Highway, Golden Triangle).
- `GET /api/v1/super-app/offline/bundles/:bundleId`: Inspect multi-layer bundle manifest (Vector tiles, Road routing graph, Searchable POI SQLite index, 3D landmark meshes).
- `GET /api/v1/super-app/offline/bundles/:bundleId/delta`: Differential delta patch generation providing ~82.5% download bandwidth savings.
- `POST /api/v1/super-app/offline/route-fallback`: Client-side offline navigation fallback computing turn-by-turn routes with zero cellular connectivity.
- `GET /api/v1/super-app/offline/storage-quota`: Device storage quota analysis with recommended bundle pruning list.

### 🌐 4D Dynamic Space Rendering & High-Precision Indoor View API Reference

#### 360-Degree Street View covering >95% Indian Urban Centers
- `GET /api/v1/spatial-vis/street-view/coverage`: Quantitative coverage analytics across Tier 1, Tier 2, and Tier 3 Indian urban centers (>95% coverage, 520+ urban centers, 1.25M+ km mapped, National Geospatial Policy 2022 compliant).
- `GET /api/v1/spatial-vis/street-view/cities`: Directory of Indian urban centers filtered by region (`north`, `south`, `west`, `east`, `central`, `northeast`) or tier (`tier1`, `tier2`, `tier3`).
- `GET /api/v1/spatial-vis/street-view/nearest`: Nearest high-definition 360-degree spherical panorama lookup by latitude, longitude, and heading tolerance.
- `GET /api/v1/spatial-vis/street-view/panorama/:panoId`: Full 8K UHD panorama metadata, spherical equirectangular & cubemap URLs, 3D LiDAR depth buffers, connected road graph hotspots, and semantic AR overlays (Delhi/Mumbai Metro pillars, speed limits, shop facades).
- `POST /api/v1/spatial-vis/street-view/sequence`: Virtual 360 drive-through tour sequence along a road or route corridor with smooth heading interpolation.
- `POST /api/v1/spatial-vis/street-view/depth-measure`: Sub-meter 3D depth measurement from equirectangular pixels using LiDAR depth maps (facade distances, road widths, vertical clearances).

#### High-Precision Indoor View (Interactive Maps)
- `GET /api/v1/spatial-vis/indoor/facilities`: Catalog of high-precision indoor facilities categorized by `commercial_complex`, `international_airport`, `train_hub`, or `metro_interchange`.
  - **Commercial Complexes**: DLF Cyber City & Cyber Hub Gurugram, World Trade Center Bengaluru, Bandra-Kurla Complex (BKC) Mumbai.
  - **International Airports**: Indira Gandhi International (DEL / IGI Terminal 3), Chhatrapati Shivaji Maharaj International (BOM / CSMIA Terminal 2), Kempegowda International (BLR T2 Garden Terminal).
  - **Multi-Level Train Hubs**: New Delhi Railway Station (NDLS) + Airport Express Metro Interchange, CSMT Mumbai, Anand Vihar Multi-Modal Mega Hub.
- `GET /api/v1/spatial-vis/indoor/facilities/:facilityId`: Digital twin facility metadata, multi-floor levels, boundary, and vertical connectors.
- `GET /api/v1/spatial-vis/indoor/facilities/:facilityId/floors/:floorLevel`: High-precision interactive 2D/3D floor plan (corridors, DigiYatra gates, CISF security checkpoints, boarding gates, baggage carousels, train platforms, skywalks, food courts).
- `POST /api/v1/spatial-vis/indoor/facilities/:facilityId/route`: Multi-floor indoor turn-by-turn routing with vertical transitions (elevators, escalators, stairs) and wheelchair accessibility (`accessibleOnly: true`).

#### 4D Dynamic Space Rendering
- `GET /api/v1/spatial-vis/dynamic-4d/scene`: 4D space rendering state combining 3D space with the temporal dimension $t$, diurnal lighting phases (`dawn`, `morning_peak`, `midday`, `golden_hour`, `twilight`, `night_urban`), dynamic vehicle/pedestrian streams, and Indian weather dynamics (monsoon wet reflections, Delhi winter fog).
- `POST /api/v1/spatial-vis/dynamic-4d/time-slider`: 4D temporal time-slider interpolation between capture epochs, demonstrating infrastructure evolution over time.



Compile TypeScript for production:

```bash
npm run build
```

---

## 📁 Production Feature-Based Modular Architecture

The backend utilizes an enterprise **Domain-Driven, Feature-Based Modular Architecture** where each capability is an autonomous, self-contained module encapsulating its own controllers, services, Mongoose models, Express routes, Socket.IO handlers, and TypeScript contracts. Common infrastructural cross-cutting concerns reside within the `src/core` foundation layer, and legacy technical layers (`controllers/`, `services/`, etc.) maintain 100% backward-compatible re-export facades.

```
src/
├── core/                                   # 🧱 Cross-Cutting Infrastructure Layer
│   ├── config/                             # Zod-validated environment, Mongo, Redis, Logger
│   ├── constants/                          # System & WebSocket event identifiers
│   ├── middlewares/                        # Error, 404, validation middleware
│   ├── types/                              # Core GeoJSON, OSRM contracts
│   ├── utils/                              # Turf.js geospatial math, API response formatters
│   └── index.ts                            # Central core barrel export
│
├── modules/                                # 📦 Self-Contained Domain Feature Modules
│   ├── health/                             # System liveness, readiness, uptime probes
│   ├── routes/                             # OSRM turn-by-turn, Redis cache, TSP matrix, trip matching
│   ├── places/                             # 2dsphere POI queries, $near, polygon bounding, text search
│   ├── navigation/                         # Live Turn-by-Turn engine, step advancement, dynamic reroute
│   ├── tracking/                           # Real-time driver/courier GPS ingestion, Redis GEOSEARCH
│   ├── positioning/                        # RTK centimeter precision, EKF sensor fusion, Dead Reckoning, BLE
│   ├── lane-routing/                       # HD Lane guidance, Bus lane restrictions, Veteran driver shortcuts
│   ├── unified-engine/                     # Unified underlying engine pipeline, Proactive energy & parking
│   ├── ai-data-mining/                     # ST-DBSCAN trajectory mining, Golden Record POI fusion, Road change
│   ├── sr-navigation/                      # Spatial Reality HUD, sub-meter lateral offset, 3D junction cards
│   ├── automotive/                         # Apple CarPlay / Android Auto templates, AAOS VHAL, CAN bus eco
│   ├── rider-mode/                         # Motorcycle roll angle dynamics, crosswind safety, e-Call crash
│   ├── parking/                            # Indoor parking navigation, A* floor pathfinding, Find My Car
│   ├── car-navigation/                     # Multi-strategy car routing, speed radars, EV energy consumption
│   ├── public-transit/                     # Multimodal transit routing, platform exit guide, live departures
│   ├── ar-walk-cycle/                      # AR 3D chevrons, accessible pedestrian paths, bike lane elevation
│   ├── ai-copilot/                         # Conversational LLM copilot, Vision hazard OCR, departure optimizer
│   ├── spatial-visualization/              # 3D Digital Twin, Vector tiles, 360 Street View (>95% Indian Urban)
│   ├── super-app/                          # All-in-One Ride-Hailing, POI Lifestyle Booking, Offline Maps & Delta Sync
│   ├── navic/                              # NavIC / IRNSS L5+S dual-frequency GNSS fix & GAGAN augmentation
│   ├── tolls/                              # FASTag electronic toll calculation & nearby plaza tariffs
│   ├── pincode/                            # 6-digit Indian PIN code lookup & address entity parser
│   ├── digipin/                            # National 4m x 4m micro-grid DIGIPIN encoder/decoder
│   ├── emergency/                          # SOS emergency dispatch (112, 1033) & nearby trauma/patrol units
│   ├── environment/                        # CPCB Air Quality Index (AQI), solar potential & pollen levels
│   ├── weather/                            # Highway fog/rain conditions & IMD weather alert overrides
│   ├── hazards/                            # Crowdsourced road hazards, unmarked speed breakers, potholes
│   ├── vernacular/                         # Turn-by-turn audio voice prompts in 10+ Indian languages
│   ├── v2x/                                # V2X SPaT signal phase timing & GLOSA green wave speed advisory
│   ├── obfuscation/                        # Differential privacy (Laplace) & WGS84/GCJ02/BD09 datum transforms
│   ├── boundaries/                         # Survey of India (SOI) territorial boundaries & region masking
│   ├── evcharging/                         # EV charging network, connector availability (CCS2, Type 2, etc.)
│   ├── fares/                              # Official municipal RTO metered fares (Auto, Kaali-Peeli, Cab)
│   ├── roads/                              # Roads API snap-to-roads and speed limit lookups
│   ├── maps-tiles/                         # MapLibre vector tile styles, static SVG map generator, clusters
│   ├── fleet/                              # Commercial fleet telemetry & on-demand trip dispatch
│   ├── timezone/                           # Geospatial coordinate to timezone resolver (Asia/Kolkata)
│   ├── ratings/                            # User ratings and reviews moderation feed
│   ├── admin/                              # Admin command center, live metrics, and operational overrides
│   ├── traffic/                            # Real-time BPR speeds, LWR shockwaves, tea-stall outlier filter
│   ├── app-version/                        # Sovereign release governance, OTA bundle patching & broadcast
│   ├── telemetry-ingestion/                # High-throughput async worker, 120+ metrics, fraud scoring
│   └── index.ts                            # Master barrel export for all domain modules
│
├── routes/                                 # Global router mounting modular endpoints (with legacy facades)
├── sockets/                                # Global Socket.IO gateway registering modular handlers
├── app.ts                                  # Express application bootstrap
└── server.ts                               # Production HTTP & WebSocket server entrypoint
```

---

## 📜 License
MIT
