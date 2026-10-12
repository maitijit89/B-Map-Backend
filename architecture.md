# 🏛️ B-Map Platform Architecture Specification

> **Sovereign Indian Geospatial, Turn-by-Turn Navigation & Real-Time Telematics Engine**  
> *Version:* 1.2.0 | *Runtime:* Node.js 24 + TypeScript | *Revision:* Production-Ready

---

## 1. Architectural Philosophy & Overview

**B-Map** is an enterprise-scale geospatial, routing, and real-time navigation platform designed specifically for the Indian subcontinental geography while retaining global compatibility. The platform is architected around the following foundational principles:

1. **Decoupled Modularity**: Over 40 discrete domain modules operate independently behind a unified Express router, enabling clean domain boundary separation.
2. **Sub-Millisecond Geospatial Caching**: High-frequency spatial queries (routes, driver tracking, nearby points of interest) leverage Redis in-memory caches, `GEOADD`, and `GEOSEARCH` primitives before querying persistent storage.
3. **Sovereign Indian Navigation Stack**: Native first-class integration with ISRO NavIC (IRNSS) dual-frequency L5/S-band satellite positioning, DigiPIN 4m×4m hierarchical addressing, Postal Pincodes, FASTag Toll pricing, and IMD Highway Weather advisories.
4. **Dual-Tier Offline Resilience**: Critical endpoints operate seamlessly even during database or network partition states via intelligent in-memory fallback stores and mock caches.
5. **Bidirectional Low-Latency Telematics**: Socket.IO-driven real-time positioning, driver breadcrumbs, Head-Up Display (HUD) progress streaming, and instant off-route reroute notifications.

---

## 2. High-Level System Architecture Diagram

```mermaid
graph TD
    subgraph Client_Layer [Clients & Endpoints]
        MobApp[Mobile App: React Native / Flutter]
        WebPortal[Web Dashboard & Admin Portal]
        AutoHUD[Connected Vehicle / Android Auto / Apple CarPlay]
        IoTSensors[BLE Beacons & GPS/NavIC Receivers]
    end

    subgraph Security_Gateway [Ingress & Security Perimeter]
        RevProxy[Reverse Proxy / Nginx / Cloudflare]
        HelmetSec[Helmet.js Security Headers]
        CORSModule[CORS Whitelist & Origin Reflection]
        RateLimiter[Express Rate Limiter: IP & Auth Buckets]
        JWTMiddleware[JWT HS256 Authenticator & RBAC Guard]
        ZodValidator[Zod Schema Request Validator]
    end

    subgraph Application_Core [B-Map Application Core: Express 5 + Node.js 24]
        Router[API Route Aggregator: /api/v1/*]

        subgraph Core_Navigation [Navigation & Routing Engines]
            OSRMEngine[OSRM Routing Client: Driving, Bike, Foot]
            TripTSP[TSP Waypoint Optimizer: 2-Opt Heuristics]
            OffRouteDetect[Cross-Track Error Off-Route Detector]
            LaneGuidance[Multi-Lane Precision Router]
        end

        subgraph Sovereign_GIS [Sovereign Indian GIS Services]
            NavICService[ISRO NavIC Dual-Band L5/S Processor]
            DigiPINEngine[DigiPIN 10-Char Hierarchical Grid Engine]
            TollEngine[NHAI FASTag Dynamic Fee Calculator]
            PincodeEngine[Department of Posts Spatial Index]
            DefenseObfuscate[Sensitive Zone Polygon Masking]
        end

        subgraph Realtime_Telematics [Real-Time Telematics & AI]
            SocketServer[Socket.IO Telematics Gateway]
            BeaconMapper[BLE Beacon Indoor Positioning Engine]
            AICopilot[Natural Language Voice Copilot]
            TrafficEngine[Dynamic Speed Re-Weighting & Overrides]
        end

        subgraph Admin_Domain [Administrative Control Center]
            AdminService[System Health, Metrics & Overrides]
            AuditTrail[Immutable Admin Audit Logging]
            GlassmorphicUI[Server-Rendered Glassmorphic Web Portal]
        end
    end

    subgraph Cache_And_PubSub [High-Performance Cache & Streaming]
        RedisCluster[Redis: Cache TTL, Route Cache, GEOADD / GEOSEARCH]
    end

    subgraph Persistence_Layer [Persistent Storage]
        MongoCluster[(MongoDB Atlas: 2dsphere Geospatial Index)]
    end

    subgraph External_Services [External Upstream Services]
        OSRMCluster[Public / Dedicated OSRM Routing Nodes]
        GmailSMTP[Gmail SMTP OTP Dispatcher]
        CloudinaryCDN[Cloudinary Media & Hazard Photo Storage]
        GoogleMaps[Google Places & Distance Matrix API]
    end

    %% Client Connections
    MobApp -->|HTTPS / WSS| RevProxy
    WebPortal -->|HTTPS| RevProxy
    AutoHUD -->|WSS Socket.IO| RevProxy
    IoTSensors -->|Telemetry Payload| RevProxy

    %% Gateway Flow
    RevProxy --> HelmetSec
    HelmetSec --> CORSModule
    CORSModule --> RateLimiter
    RateLimiter --> ZodValidator
    ZodValidator --> JWTMiddleware
    JWTMiddleware --> Router

    %% Router Distribution
    Router --> Core_Navigation
    Router --> Sovereign_GIS
    Router --> Realtime_Telematics
    Router --> Admin_Domain

    %% Internal Component Links
    Core_Navigation --> OSRMCluster
    Core_Navigation <--> RedisCluster
    Core_Navigation <--> MongoCluster
    Realtime_Telematics <--> SocketServer
    SocketServer <--> RedisCluster
    Sovereign_GIS <--> MongoCluster
    Admin_Domain <--> MongoCluster
    Admin_Domain <--> RedisCluster
    Admin_Domain --> GlassmorphicUI

    %% External Links
    Router --> GmailSMTP
    Router --> CloudinaryCDN
    Router --> GoogleMaps
```

---

## 3. Layered Architectural Breakdown

### 3.1 Client Tier
The client tier consists of heterogeneous mobile, web, automotive, and IoT consumers:
- **Mobile Native Applications**: Built with React Native or Flutter, communicating via JSON REST endpoints for bootstrap data and persistent WebSocket channels for turn-by-turn guidance.
- **In-Vehicle Infotainment (IVI)**: Android Automotive OS, Apple CarPlay, and connected dashboard displays consuming Lane-Level routing, Speed-Camera alerts, and V2X notifications.
- **Admin Control Web Center**: Built as a responsive, server-rendered glassmorphic single-page experience served directly from `/admin/dashboard`.
- **Bluetooth Low Energy (BLE) Nodes**: Hardware beacons positioned in multistory parking facilities, metro stations, and shopping malls transmitting UUID, Major, and Minor broadcast packets.

### 3.2 Ingress & Security Perimeter Tier
All inbound HTTP and WebSocket requests pass through strict defence-in-depth security layers:
- **Reverse Proxy / SSL Termination**: Enforces TLS 1.3 encryption, gzip/brotli compression, and IP forwarding headers (`X-Forwarded-For`).
- **HTTP Header Hardening (`helmet`)**: Strips `X-Powered-By`, injects `Content-Security-Policy`, `Strict-Transport-Security` (HSTS), `X-Frame-Options: SAMEORIGIN`, and `X-Content-Type-Options: nosniff`.
- **CORS Hardening**: Dynamically reflects trusted origins when `credentials: true` is asserted, adhering to RFC and W3C specifications without illegal wildcard collisions.
- **Dual-Tier Rate Limiting (`express-rate-limit`)**:
  - `authRateLimiter`: Restricts `/api/v1/auth/*` to **15 attempts per 15 minutes** per IP to eliminate credential-stuffing and SMTP exhaustion attacks.
  - `apiRateLimiter`: Restricts general API queries to **300 requests per minute** per client.
- **Input Sanitization & Schema Validation (`zod`)**: Validates `req.body`, `req.query`, and `req.params` against strict types before execution reaches controller handlers.

### 3.3 Application Core & Domain Tier
The backend adopts a modular domain architecture where each capability is isolated in `src/modules/<domain>/`:

```
src/modules/
├── admin/               # Web dashboard, dynamic config, audit logs, traffic/weather overrides
├── ai-copilot/          # Natural Language Voice Navigation & LLM Copilot
├── ai-data-mining/      # Spatial pattern mining, congestion prediction, trip profiling
├── ar-walk-cycle/       # Augmented Reality walking and micromobility guidance
├── auth/                # Email OTP signup, passwordless login, JWT HS256 tokens
├── automotive/          # Automotive HUD telemetry, ADAS, collision prevention
├── boundaries/          # GeoJSON boundaries (states, districts, municipal wards)
├── car-navigation/      # Multi-alternative vehicle routes, lane guidance
├── digipin/             # ISRO/DoP 4m x 4m hierarchical alphanumeric digital address grid
├── emergency/           # Emergency SOS distress dispatch, nearest ambulance/police routing
├── environment/         # Air Quality Index (AQI), green eco-routes, low-emission zones
├── evcharging/          # EV charging stations, connector availability, range planning
├── fares/               # Auto-rickshaw, taxi, and metro fare estimation matrices
├── fleet/               # Multi-vehicle fleet telematics, geofence monitoring
├── hazards/             # Community & official road hazards (potholes, accidents, floods)
├── health/              # System uptime, memory metrics, MongoDB/Redis connectivity checks
├── lane-routing/        # High-definition lane-level maneuvers & highway lane assist
├── location-access/     # GPS telemetry ingestion, batch location uploading
├── maps-tiles/          # Vector and raster map tile proxying and rendering
├── motion-fitness/      # Accelerometer activity detection (driving, walking, cycling)
├── navic/               # ISRO NavIC L5/S-band constellation processing & augmentation
├── navigation/          # Active navigation session engine, cross-track error, rerouting
├── nearby-devices/      # Bluetooth BLE beacon indoor trilateration & mapping
├── notifications/       # Push notifications, geofence boundary alerts
├── parking/             # Multilevel indoor parking guidance & slot availability
├── pincode/             # Indian 6-digit postal code spatial search & geocoding
├── places/              # Points of Interest (POIs), categories, MongoDB $near geospatial queries
├── positioning/         # Multi-sensor positioning, dead reckoning, sensor fusion
├── public-transit/      # Delhi Metro, BMTC, BEST bus timetables & multimodal routing
├── ratings/             # Place reviews, road quality crowdsourced ratings
├── rider-mode/          # Two-wheeler specific navigation (narrow lanes, flyover restrictions)
├── roads/               # National Highway (NH), Expressways, state road metadata
├── routes/              # OSRM route directions, TSP trip optimization, map matching
├── spatial-visualization/# 3D terrain meshes, building footprints, traffic heatmaps
├── sr-navigation/       # Spatial Reality mixed-reality navigation HUD
├── super-app/           # Super-app unified commerce, fuel stations, roadside dining
├── timezone/            # Indian Standard Time (IST) geospatial timezone mapping
├── tolls/               # NHAI FASTag electronic toll plazas, rates, cashless lanes
├── tracking/            # Real-time driver location tracking, Redis GEO proximity
├── unified-engine/      # Orchestrated multimodal route synthesis
├── v2x/                 # Vehicle-to-Everything (V2X) hazard & signal broadcasting
├── vernacular/          # 12 Indian regional language voice direction translation
└── weather/             # IMD highway weather advisories, monsoon flooding, winter fog
```

### 3.4 Storage, Caching & Real-Time Tier
- **MongoDB Cluster**: Primary document store utilizing `2dsphere` geospatial indices on `[longitude, latitude]` coordinate pairs for high-performance `$near`, `$geoWithin`, and `$geoIntersects` queries.
- **Redis In-Memory Engine**:
  - **Route Cache**: Hashes origin/destination/waypoints into deterministic keys with an expiring TTL (default: 3600s).
  - **Spatial Geo Tracking**: Leverages `GEOADD` and `GEOSEARCH` primitives for sub-millisecond proximity detection of active drivers.
  - **OTP Temporary Store**: Holds 6-digit verification codes with an automatic 300s TTL.
- **Socket.IO Real-Time Gateway**:
  - WebSocket rooms keyed by session ID (`nav:<sessionId>`) and driver ID (`driver:<driverId>`).
  - Broadcasts location updates at 1Hz–5Hz frequencies.
  - Pushes instantaneous off-route reroute geometry directly to mobile HUDs.

---

## 4. Sovereign Indian Navigation Stack

```mermaid
flowchart LR
    subgraph Raw_Sensors [Raw Sensor Stream]
        L5[ISRO NavIC L5 Signal: 1176.45 MHz]
        S[ISRO NavIC S-Band: 2492.028 MHz]
        GPS[GPS L1 C/A: 1575.42 MHz]
        BLE[BLE Beacons: Indoor RSSI]
    end

    subgraph NavIC_Engine [NavIC Augmentation Engine]
        DOP[Dilution of Precision Analyzer]
        Fusion[Weighted Multi-Constellation Fusion]
    end

    subgraph Indian_GIS [National Geospatial Infrastructure]
        DigiPIN[DigiPIN 4m x 4m Grid Engine]
        FASTag[NHAI FASTag Toll Calculator]
        IMD[IMD Highway Weather Overrides]
        Vernacular[12 Indian Languages TTS Engine]
    end

    subgraph Output [Optimized Guidance]
        HUD[Sub-Meter Precision Indian Navigation]
    end

    L5 --> DOP
    S --> DOP
    GPS --> DOP
    DOP --> Fusion
    BLE --> Fusion
    Fusion --> DigiPIN
    Fusion --> FASTag
    Fusion --> IMD
    Fusion --> Vernacular
    DigiPIN --> HUD
    FASTag --> HUD
    IMD --> HUD
    Vernacular --> HUD
```

### Key Sovereign Integrations:
1. **ISRO NavIC Dual-Frequency Processing**: Ingests L5 and S-band carrier frequencies to bypass ionospheric delay errors common in tropical equatorial regions.
2. **DigiPIN Hierarchical Grid**: Transforms any latitude/longitude across India into a 10-character alphanumeric digital address accurate to a 4m×4m cell.
3. **National FASTag Toll Database**: Computes real-time toll charges for National Expressways (e.g., Delhi-Mumbai NE-4, Yamuna Expressway, NH-48) with vehicle-class pricing.
4. **IMD Severe Weather Integration**: Broadcasts automated reroutes during heavy monsoon flooding or zero-visibility northern winter fog.
5. **Vernacular Multi-Lingual Directions**: Voice-ready directional strings translated across 12 Indian languages: Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, and English.

---

## 5. Offline-First Resilience & In-Memory Fallback

To ensure non-stop navigation during connectivity blackouts or database maintenance, the system implements an active fallback pattern:

```mermaid
sequenceDiagram
    participant Client
    participant Router
    participant Service
    participant Mongo as MongoDB Atlas
    participant MemFallback as In-Memory Cache Store

    Client->>Router: GET /api/v1/places/nearby
    Router->>Service: getNearbyPlaces(coords)
    Service->>Mongo: Place.find($near)
    alt MongoDB Available
        Mongo-->>Service: Return 2dsphere search results
        Service-->>Router: Format GeoJSON
    else MongoDB Disconnected / DNS Refused
        Mongo--xService: Connection Error
        Service->>MemFallback: Query in-memory spatial store
        MemFallback-->>Service: Return seed Indian POIs & Expressways
        Service-->>Router: Format GeoJSON with fallback notice
    end
    Router-->>Client: 200 OK (Continuous Service)
```

---

## 6. Security & Compliance Architecture

| Security Domain | Implementation | Security Standard |
| :--- | :--- | :--- |
| **Authentication** | Passwordless 6-digit OTP dispatched via TLS SMTP | NIST SP 800-63B |
| **Session Integrity**| JWT signed with HS256, verified with pinned algorithm | RFC 7519 / OWASP A02 |
| **Transport** | TLS 1.3, Strict-Transport-Security (1 year, includeSubDomains) | OWASP A05 |
| **API Rate Limiting**| Dual sliding-window token bucket (Auth: 15/15m, General: 300/1m)| OWASP A04 (Anti-Automation) |
| **ReDoS Defense** | All dynamic RegExp expressions escaped via `escapeRegExp()` | CWE-1333 / CWE-400 |
| **XSS Defense** | Entity encoding (`escapeHtml()`) on all dynamic UI templates | CWE-79 / OWASP A03 |
| **Credential Safety**| Zero default secrets in code; runtime validation via Zod | CWE-798 |
| **Defense Obfuscation**| Sensitive military & national security polygon masking | National Geospatial Policy |

---

## 7. Deployment & Scalability Topology

```mermaid
graph TB
    subgraph Cloud_Infrastructure [Docker / Kubernetes Cluster]
        LoadBalancer[Cloud Load Balancer / Ingress]
        Node1[B-Map Node Pod 1]
        Node2[B-Map Node Pod 2]
        NodeN[B-Map Node Pod N]
    end

    subgraph Data_Services [Managed Cloud Persistence]
        RedisPrimary[(Redis Cache Primary)]
        RedisReplica[(Redis Read Replica)]
        MongoPrimary[(MongoDB Primary)]
        MongoSec[(MongoDB Secondary)]
    end

    LoadBalancer --> Node1
    LoadBalancer --> Node2
    LoadBalancer --> NodeN

    Node1 <--> RedisPrimary
    Node2 <--> RedisPrimary
    NodeN <--> RedisPrimary
    RedisPrimary -.-> RedisReplica

    Node1 <--> MongoPrimary
    Node2 <--> MongoPrimary
    NodeN <--> MongoPrimary
    MongoPrimary -.-> MongoSec
```
- **Horizontal Scaling**: Stateless Express containers can scale horizontally across Kubernetes pods.
- **WebSocket Sticky Sessions**: When scaled behind multiple pods, Socket.IO uses Redis adapter (`@socket.io/redis-adapter`) for cross-node event broadcasting.
- **Health Probing**: Kubernetes `livenessProbe` and `readinessProbe` target `/api/v1/health` with sub-50ms latency checks.
