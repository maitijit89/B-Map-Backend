# B-Map Backend 🗺️

[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go)](https://golang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0%202dsphere-47A248?style=flat&logo=mongodb)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=flat&logo=redis)](https://redis.io)
[![Gin Framework](https://img.shields.io/badge/Framework-Gin-008ECF?style=flat)](https://gin-gonic.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A high-performance, enterprise-grade navigation, mapping, and geospatial platform backend built in **Go (Golang)**. Designed as a comprehensive **Google Maps Platform equivalent**, featuring real-time navigation, Contraction Hierarchies, V2X municipal traffic light integration (SPaT), RTK lane-level positioning, dynamic MongoDB 2dsphere vector tiles (MVT), and offline bounding box map packaging.

---

## 📚 Documentation
- 📐 **[System Architecture & Design Document (architecture.md)](architecture.md)**
- 📜 **[Engineering & Security Guidelines (rules.md)](rules.md)**
- 📄 **[OpenAPI 3.0 Specification (api/openapi.yaml)](api/openapi.yaml)**

---

## 🏛️ System Architecture Overview

```
e:\B-Map-Backend
├── cmd/
│   ├── api/               # Fiber HTTP API entrypoint
│   └── server/            # Production Gin HTTP / WebSocket server entrypoint
│       └── main.go
├── config/                # Environment configuration loader (.env)
│   └── config.go
├── internal/              # Core domain engines & business logic
│   ├── auth/              # Cryptographic OTP, JWT dual-token lifecycle & profile
│   ├── boundaries/        # Survey of India (SOI) official red territorial borders
│   ├── domain/            # Core models (Place, Vehicle, Trip, RoadNode, Boundary)
│   ├── environment/       # Air Quality Index (AQI), Solar potential, Pollen API
│   ├── fleet/             # Real-time driver matching, trip dispatch & telemetry
│   ├── geocoding/         # Forward/reverse geocoding & address validation (0-100 score)
│   ├── geoextras/         # Geolocation (IP/WiFi), Elevation (DEM), TimeZone lookup
│   ├── hdmap/             # Autonomous driving perception ingestion & change consensus
│   ├── lanelevel/         # RTK ground enhancement (cm-accuracy) & lane guidance
│   ├── maps/              # Dynamic Mapbox Style Spec v8, Static SVG maps & clustering
│   ├── navic/             # NavIC (IRNSS) & GAGAN SBAS Regional Satellite Positioning
│   ├── offline/           # Bounding box map bundler (.bmap / .tar.gz) with SHA-256
│   ├── pincode/           # 6-Digit Indian PIN Code lookup & landmark-centric parsing
│   ├── places/            # Full-text & proximity POI search, autocomplete & Indian seeding
│   ├── realtime/          # Gorilla WebSocket Hub & Redis Pub/Sub broadcast coordinator
│   ├── repository/        # MongoDB & Redis data repositories
│   │   ├── mongodb/       # MongoDB collections (Users, Places with 2dsphere index)
│   │   └── redis/         # Redis OTP store
│   ├── roadhazards/       # Indian speed breaker & monsoon flood warning intelligence
│   ├── routes/            # Contraction Hierarchies (CH), A*, Multi-Modal Transit, Roads API
│   ├── spatial/           # O(log N) Redis GEO spatial indexer
│   ├── tiles/             # Dynamic 2dsphere vector tile server with L1/L2 caching
│   ├── toll/              # Indian FASTag electronic toll collection & expressways
│   ├── traffic/           # High-throughput GPS telemetry ingest & dynamic ETA engine
│   ├── v2x/               # Municipal SPaT signal timing & GLOSA speed advisory
│   └── vernacular/        # Multilingual voice turn guidance (10 Indian official languages)
├── pkg/                   # Enterprise infrastructure packages
│   ├── cache/             # High-performance in-memory L1 LRU cache (TTL & eviction)
│   ├── database/          # MongoDB (2dsphere geospatial) & Redis connection pools
│   ├── metrics/           # Prometheus metrics middleware & health monitor (/metrics)
│   ├── middleware/        # Token bucket rate limiter, OWASP security headers, Request ID
│   ├── response/          # Unified JSON standard response envelope
│   └── utils/             # Haversine, bearing, turn angles & Google Polyline 5-decimal
├── api/
│   └── openapi.yaml       # OpenAPI 3.0 API Specification
├── deployments/
│   ├── docker/            # Multi-stage Docker container build & Compose setup
│   └── k8s/               # Kubernetes Deployment & Service manifests
├── scripts/               # Standalone database seeders and migration utilities
├── Makefile               # Enterprise build, test, and container automation
├── Dockerfile             # Multi-stage production container build
├── docker-compose.yml     # Local orchestration with MongoDB 7.0 & Redis 7
├── go.mod
└── go.sum
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Go 1.22+**
- **Docker & Docker Compose**

### 2. Clone & Setup Environment
```bash
git clone https://github.com/maitijit89/B-Map-Backend.git
cd B-Map-Backend
cp .env.example .env
```

### 3. Launch Database & Redis
```bash
docker-compose up -d
```

### 4. Run the Production Server
```bash
go run cmd/server/main.go
# or using Makefile:
make run
```
The server will start on `http://localhost:8080` with all spatial indexes auto-created and sample POI data seeded.

### 5. Run Comprehensive Test Suite
```bash
go test -v ./...
# or using Makefile:
make test
```

---

## 📡 Complete API Catalog & cURL Examples

### 1. 🔐 Authentication Module (OTP-Based)
```bash
# Request 6-digit cryptographic OTP
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Verify OTP & retrieve JWT
curl -X POST http://localhost:8080/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "otp": "123456"}'
```

### 2. 🗺️ Maps, Styles, Static Maps & Marker Clustering
```bash
# Mapbox Style Spec v8 (Themes: standard, dark, night, retro, silver, aubergine)
curl "http://localhost:8080/api/v1/maps/style.json?theme=dark"

# High-resolution Static Map (SVG/PNG with drop-shadow pins)
curl "http://localhost:8080/api/v1/maps/static?center=37.7749,-122.4194&zoom=14&size=800x600&theme=dark"

# Dynamic Marker Clustering
curl "http://localhost:8080/api/v1/maps/clusters?zoom=12"
```

### 3. 🔴 The Red Border, Mandated Lines & Search Highlighting
```bash
# Sovereign Red Borders (Jurisdictions: GLOBAL, IN, US)
curl "http://localhost:8080/api/v1/boundaries/territorial?locale=GLOBAL&level=0"

# Search Highlighting with Inverted Background Mask
curl "http://localhost:8080/api/v1/boundaries/highlight?q=California"
```

### 4. 🧠 Routing, Directions & Contraction Hierarchies
```bash
# Multi-modal routing (driving, walking, bicycling, transit)
curl "http://localhost:8080/api/v1/routes/directions?origin=37.7749,-122.4194&destination=37.7955,-122.3937&mode=driving"

# Public Transit with subway/bus legs and transfer stations
curl "http://localhost:8080/api/v1/routes/directions?origin=37.7749,-122.4194&destination=37.7955,-122.3937&mode=transit"

# N x M Distance Matrix
curl "http://localhost:8080/api/v1/routes/distance-matrix?origins=37.7749,-122.4194|37.7833,-122.4167&destinations=37.7955,-122.3937|37.7681,-122.3920"
```

### 5. 🚦 Connected Vehicles (V2X) & Traffic Light Timing (SPaT)
```bash
# Query live signal phase & countdown
curl "http://localhost:8080/api/v1/v2x/spat/sig_market_4th"

# Green Light Optimal Speed Advisory (GLOSA)
curl -X POST http://localhost:8080/api/v1/v2x/glosa/advisory \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_location": { "lat": 37.7850, "lng": -122.4060 },
    "speed_kmh": 40.0,
    "intersection_id": "sig_market_4th"
  }'
```

### 6. 🛰️ Ground Enhancement & Lane-Level Positioning
```bash
# RTK Carrier-Phase GNSS Correction (cm-accuracy)
curl -X POST http://localhost:8080/api/v1/lanelevel/rtk/correct \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude_meters": 15.2,
    "hdop": 0.85,
    "satellites_in_view": 16
  }'

# Active Lane Guidance Cues
curl "http://localhost:8080/api/v1/lanelevel/guidance?lat=37.77&lng=-122.41&maneuver=turn_left&dist=200"
```

### 7. ⚡ Real-Time Traffic & Dynamic ETA Recalculation
```bash
# Ingest vehicle GPS telemetry pings
curl -X POST http://localhost:8080/api/v1/traffic/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "pings": [
      {
        "device_id": "car_01",
        "location": { "lat": 37.7850, "lng": -122.4070 },
        "speed_kmh": 14.0,
        "heading": 90.0,
        "timestamp": "2026-08-31T13:00:00Z",
        "road_segment_id": "seg_market_st"
      }
    ]
  }'

# Dynamic ETA with Faster Detour Alert
curl -X POST http://localhost:8080/api/v1/traffic/evaluate-eta \
  -H "Content-Type: application/json" \
  -d '{
    "route_polyline": "mock_polyline",
    "initial_eta_seconds": 600
  }'
```

### 8. 📦 Offline Map Sync (Bounding Box Bundles)
```bash
# Generate offline map package (.bmap)
curl -X POST http://localhost:8080/api/v1/offline/bundles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "San Francisco Bay Area",
    "bounding_box": [-122.515, 37.708, -122.355, 37.835],
    "min_zoom": 10,
    "max_zoom": 14
  }'

# Download binary archive with SHA-256 integrity check
curl -OJ "http://localhost:8080/api/v1/offline/bundles/{bundle_id}/download"
```

### 9. 🛡️ Coordinate Obfuscation (GCJ-02/BD-09 & Differential Privacy)
```bash
# Geopolitical datum shift (WGS84 -> GCJ02)
curl -X POST http://localhost:8080/api/v1/obfuscation/transform \
  -H "Content-Type: application/json" \
  -d '{
    "location": { "lat": 39.9042, "lng": 116.4074 },
    "source_datum": "WGS84",
    "target_datum": "GCJ02"
  }'

# Differential Privacy Spatial Cloaking (Laplace Noise)
curl -X POST http://localhost:8080/api/v1/obfuscation/fuzz \
  -H "Content-Type: application/json" \
  -d '{
    "location": { "lat": 37.7749, "lng": -122.4194 },
    "radius_meters": 200.0,
    "epsilon": 0.5
  }'
```

### 10. 🛰️ NavIC (IRNSS) & GAGAN SBAS Regional Positioning
```bash
# Process NavIC dual-frequency fix with GAGAN sub-meter correction
curl -X POST http://localhost:8080/api/v1/navic/fix \
  -H "Content-Type: application/json" \
  -d '{
    "raw_latitude": 28.6139,
    "raw_longitude": 77.2090,
    "raw_altitude": 216.0,
    "enable_gagan": true
  }'

# Query NavIC IRNSS satellite constellation health
curl "http://localhost:8080/api/v1/navic/constellation"
```

### 11. 🛣️ FASTag Toll Calculation & National Expressways
```bash
# Estimate NHAI FASTag toll across route corridor
curl -X POST http://localhost:8080/api/v1/tolls/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "route_coordinates": [
      { "lat": 28.4595, "lng": 77.0266 },
      { "lat": 28.4067, "lng": 76.9854 }
    ],
    "vehicle_type": "CAR_JEEP_VAN",
    "is_return_trip": false
  }'
```

### 12. 📮 Indian PIN Code & Landmark-Centric Address Parsing
```bash
# Lookup 6-digit Indian PIN Code
curl "http://localhost:8080/api/v1/pincode/560034"

# Parse complex Indian landmark address
curl -X POST http://localhost:8080/api/v1/pincode/parse-address \
  -H "Content-Type: application/json" \
  -d '{
    "address": "Flat 402, Near Hanuman Temple, Opposite Metro Pillar 128, Hauz Khas, New Delhi 110016"
  }'
```

### 13. ⚠️ Indian Road Hazards (Speed Breakers & Monsoon Flooding)
```bash
# Query ahead speed breakers and waterlogging zones
curl "http://localhost:8080/api/v1/hazards/ahead?lat=28.6145&lng=77.2095&lookahead_meters=500"
```

### 14. 🗣️ Multilingual Indian Voice Prompts (10 Languages)
```bash
# Generate localized voice prompt (Hindi, Bengali, Tamil, Telugu, etc.)
curl -X POST http://localhost:8080/api/v1/vernacular/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "action": "TURN_LEFT",
    "distance_meters": 200,
    "street_name": "MG Road",
    "language": "hi-IN"
  }'
```

### 15. 📊 Observability & Prometheus Metrics
```bash
curl "http://localhost:8080/metrics?format=prometheus"
```

---

## 🧪 Quality Assurance & Test Matrix

| Test Suite | Coverage Area | Status |
|---|---|---|
| `pkg/cache` | L1 In-memory LRU cache, TTL eviction & hits/misses | **PASS** |
| `pkg/middleware` | Token bucket rate limiting (150 rps, 300 burst) | **PASS** |
| `internal/routes` | Contraction Hierarchies (CH), A*, Transit | **PASS** |
| `internal/traffic`| GPS telemetry sliding window & dynamic ETA | **PASS** |
| `internal/offline`| Bounding box tar.gz bundler & SHA256 integrity | **PASS** |
| `internal/boundaries`| Sovereign red borders & search inverted masking | **PASS** |
| `internal/v2x` | SPaT telemetry & GLOSA green-wave advisory | **PASS** |
| `internal/lanelevel`| RTK GNSS carrier-phase correction & lane cues | **PASS** |
| `internal/obfuscation`| GCJ-02/BD-09 shift & Laplace spatial cloaking | **PASS** |
| `internal/hdmap` | AV perception ingest & map consensus loop | **PASS** |
| `internal/maps` | Dynamic Vector MVT tiles & Marker clustering | **PASS** |
| `internal/geoextras`| Topographic elevation & TimeZone offset | **PASS** |
| `internal/environment`| Air Quality Index (AQI) & Solar potential | **PASS** |

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
