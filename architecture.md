# B-Map Architecture & System Design 🗺️📐

This document provides a comprehensive technical blueprint of the **B-Map Navigation & Mapping Platform Backend**.

---

## 1. 🏗️ High-Level System Architecture

```mermaid
graph TD
    Client[Mobile App / Web Client / Autonomous Vehicle]
    
    subgraph Edge & Ingress Layer
        LB[Load Balancer / Ingress Controller]
        RateLimiter[Token Bucket Rate Limiter 150 rps]
        SecurityHeaders[OWASP Security & Tracing Middleware]
    end

    subgraph Application Server [B-Map Go Core Server]
        GinRouter[Gin HTTP Router & WS Dispatcher]
        
        subgraph Engine Services
            AuthSvc[Auth & OTP Engine]
            RouteEngine[Routes & Contraction Hierarchies Engine]
            FleetSvc[Fleet Engine & Driver Matching]
            PlacesSvc[Places & 2dsphere Spatial Search]
            TileEngine[Vector Tile Server]
            BoundariesSvc[Red Borders & Mandated Lines]
            TrafficSvc[Real-Time Telemetry & Dynamic ETA]
            V2XSvc[V2X SPaT & GLOSA Advisory]
            LaneSvc[RTK Ground Enhancement & Lane Guidance]
            ObfuscationSvc[GCJ-02 Shift & Differential Privacy]
            HDMapSvc[HD Map Perception Data Loop]
            OfflineSvc[Offline Bounding Box Bundler]
        end
        
        L1Cache[In-Memory L1 LRU Cache]
        WSHub[Gorilla WebSocket Hub]
    end

    subgraph Data & Storage Layer
        RedisL2[(Redis 7 Cluster: L2 Cache, Pub/Sub, Redis GEO)]
        MongoDB[(MongoDB 7.0: 2dsphere Spatial DB)]
    end

    Client -->|HTTPS / WSS| LB
    LB --> RateLimiter
    RateLimiter --> SecurityHeaders
    SecurityHeaders --> GinRouter

    GinRouter --> AuthSvc
    GinRouter --> RouteEngine
    GinRouter --> FleetSvc
    GinRouter --> PlacesSvc
    GinRouter --> TileEngine
    GinRouter --> BoundariesSvc
    GinRouter --> TrafficSvc
    GinRouter --> V2XSvc
    GinRouter --> LaneSvc
    GinRouter --> ObfuscationSvc
    GinRouter --> HDMapSvc
    GinRouter --> OfflineSvc

    TileEngine <--> L1Cache
    RouteEngine <--> L1Cache
    
    FleetSvc <--> RedisL2
    WSHub <--> RedisL2
    AuthSvc <--> RedisL2
    TrafficSvc <--> RedisL2

    PlacesSvc <--> MongoDB
    TileEngine <--> MongoDB
    RouteEngine <--> MongoDB
    FleetSvc <--> MongoDB
    AuthSvc <--> MongoDB
    BoundariesSvc <--> MongoDB
    OfflineSvc <--> MongoDB
```

---

## 2. 🧠 The Routing & Contraction Hierarchies (CH) Engine

The routing engine calculates optimal paths across millions of road network segments in sub-milliseconds:

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Navigation App
    participant Router as Routes Engine
    participant CH as Contraction Hierarchies (CH)
    participant Traffic as Dynamic Traffic Engine
    participant Maneuver as Voice Turn Classifier

    User->>Router: GET /api/v1/routes/directions (Origin, Dest, Mode)
    Router->>CH: QueryCH(sourceNode, targetNode)
    CH-->>Router: Shortest Path Nodes & Weights
    Router->>Traffic: EvaluateLiveETA(PathPolyline)
    Traffic-->>Router: Congestion Delays & Speed Factors
    Router->>Maneuver: GenerateSteps(PathCoords, SpeedKmh)
    Maneuver-->>Router: Turn Maneuvers & Human-Readable Voice Text
    Router->>User: RouteResponse (Summary, Polyline, ETA, Bounds, Steps)
```

---

## 3. ⚡ Multi-Tier Caching Architecture

To achieve sub-millisecond latency for vector tiles, styles, and repetitive route queries, B-Map utilizes a **two-tier caching model**:

```mermaid
flowchart LR
    Req[Incoming Client Request] --> L1{L1 In-Memory LRU Cache}
    L1 -->|Hit (< 100μs)| Res[Return Cached Data]
    L1 -->|Miss| L2{L2 Redis 7 Cache}
    L2 -->|Hit (< 2ms)| CacheL1[Populate L1] --> Res
    L2 -->|Miss| DB[(MongoDB 7.0)]
    DB --> ExecQuery[Execute 2dsphere Spatial Query $geoNear / $geoWithin]
    ExecQuery --> CacheL2[Populate L2 Redis]
    CacheL2 --> CacheL1
    CacheL1 --> Res
```

---

## 4. 🛰️ Real-Time Telemetry, Fleet Tracking & WebSockets

```mermaid
graph TD
    Driver[Driver Device] -->|POST /fleet/location| FleetHandler[Fleet Telemetry Handler]
    FleetHandler --> SpatialIdx[Redis GEO Spatial Indexer GEOADD]
    FleetHandler --> RedisPub[Redis Pub/Sub fleet:broadcast]
    
    RedisPub --> WSHub[Gorilla WebSocket Hub]
    WSHub -->|WSS Real-time Push| Passenger[Passenger App / Dispatcher Map]

    PassengerReq[Passenger Request Trip] --> TripDispatch[Fleet Dispatch Engine]
    TripDispatch -->|GEOSEARCH 3km| SpatialIdx
    SpatialIdx -->|Closest 5 Drivers| TripDispatch
    TripDispatch -->|Push Notification| Driver
```

---

## 5. 🚦 Connected Vehicles (V2X) & Autonomous Driving Data Loop

### 5.1 V2X Municipal Signal Phase & Timing (SPaT)
- Real-time streaming of traffic signal states (`GREEN`, `YELLOW`, `RED`, `PROTECTED_TURN_GREEN`).
- **GLOSA (Green Light Optimal Speed Advisory)**:
  $$V_{advisory} = \frac{DistanceToIntersection}{TimeRemainingToGreen}$$
  Advises the vehicle to cruise at optimal speed to pass intersections without stopping.

### 5.2 HD Map Data Loop
- Crowdsourced sensor observations from autonomous vehicles (camera detections, LiDAR anomalies, construction cones, potholes).
- Multi-vehicle consensus engine verifies observations ($\ge 0.85$ confidence score) and automatically updates dynamic road layers.

---

## 6. 📦 Offline Map Sync (Bounding Box Bundler)

```mermaid
graph TD
    ClientReq[Client Request Bounding Box Download] --> BundleSvc[Offline Bundle Service]
    
    subgraph Data Extraction
        BundleSvc --> ExtractMVT[Extract Vector Tiles for Zoom 10-15]
        BundleSvc --> ExtractGraph[Extract Sub-Graph nodes & edges]
        BundleSvc --> ExtractPOIs[Extract Regional POIs places.json via MongoDB $geoWithin]
    end

    ExtractMVT --> TarGz[Pack into Tar.Gz Archive .bmap]
    ExtractGraph --> TarGz
    ExtractPOIs --> TarGz

    TarGz --> Checksum[Compute SHA-256 Checksum]
    Checksum --> Manifest[Generate 30-day Manifest]
    Manifest --> ClientStream[Stream Download to Client Device]
```

---

## 7. 🗄️ Database Collections & 2dsphere Spatial Indexes

| Collection | Geospatial Field | Index Type | Purpose |
|---|---|---|---|
| `places` | `location ({ type: "Point", coordinates: [lng, lat] })` | `2dsphere` | Spherical distance & bounding box queries (`$geoNear`, `$geoWithin`) |
| `places` | `name, description, address` | `text` / `regex` | High-speed typo-tolerant autocomplete |
| `vehicles` | `location ({ type: "Point", coordinates: [lng, lat] })` | `2dsphere` | Proximity driver search and dispatch |
| `trips` | `pickup_location, dropoff_location` | `2dsphere` | Mission pickup/dropoff geospatial queries |
| `boundaries`| `center_point ({ type: "Point", coordinates: [lng, lat] })` | `2dsphere` | Territorial and jurisdiction search |
| `road_nodes`| `location ({ type: "Point", coordinates: [lng, lat] })` | `2dsphere` | Map matching & nearest road node snap |
| `users` | `email` | `unique (1)` | Fast identity & auth lookups |

---

## 8. 🛡️ Security, Rate Limiting & Resilience
- **Rate Limiting**: 150 req/sec per IP with 300 burst allowance via Token Bucket.
- **OWASP Compliance**: HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`).
- **Cryptographic OTPs**: `crypto/rand` generation, Redis TTL, atomic single-use deletion.
- **Observability**: Prometheus metrics at `/metrics` tracking throughput, error rates, and connection gauges.
