# B-Map Backend Development Rules & Guidelines 📜

This document establishes the mandatory engineering standards, architectural constraints, security principles, and code hygiene rules for the **B-Map Backend**.

---

## 1. 🏛️ Architectural Principles & Package Boundaries

### 1.1 Clean Architecture / Hexagonal Boundaries
- **`cmd/`**: Entrypoints only (`cmd/server/main.go`). No business logic or database queries directly in `main.go`.
- **`internal/`**: Domain-specific business logic. Packages inside `internal/` should remain modular and maintain clear separation of concerns:
  - **`domain/`**: Pure structs, entities, and custom database types. Zero dependencies on HTTP frameworks or external SDKs.
  - **`service.go`**: Pure business logic with interface contracts.
  - **`handler.go`**: HTTP transport layer mapping JSON requests/responses, calling service methods.
- **`pkg/`**: Reusable infrastructure libraries (`pkg/cache`, `pkg/database`, `pkg/middleware`, `pkg/metrics`, `pkg/utils`). Must never import from `internal/`.

### 1.2 Import Cycle Prevention
- `internal/domain` must NEVER import from specific domain services.
- `pkg/database` must NEVER import `internal/domain` entities. Any database seeders must reside in `internal/places/seed.go` or `scripts/`.

---

## 2. ⚡ Performance & Caching Rules

### 2.1 Multi-Tier Caching
- High-frequency read paths (e.g. Map Vector Tiles, Static SVG Maps, Style JSON, Address Autocomplete) MUST utilize the **L1 LRU in-memory cache** (`pkg/cache`) before querying **L2 Redis**.
- All Redis keys MUST use strict namespacing with colons:
  - `user:otp:<email>`
  - `tile:mvt:<z>:<x>:<y>`
  - `fleet:geo:<region>`
  - `traffic:segment:<id>`
  - `offline:bundle:<id>`

### 2.2 Memory Management & Concurrency
- Use `sync.Pool` for high-frequency byte buffers (such as SVG generation and tile encoding) to minimize Garbage Collector pressure.
- Avoid spawning unmanaged goroutines. Goroutines must always be bound to a `context.Context` for graceful cancellation.
- All shared in-memory maps MUST be guarded with `sync.RWMutex` or `sync.Mutex`.

---

## 3. 🗄️ Database & Spatial Querying Standards (MongoDB 2dsphere)

### 3.1 Spatial Indexing
- Every collection containing geospatial coordinates (`places`, `vehicles`, `trips`, `boundaries`, `road_nodes`) MUST have an associated **2dsphere** spatial index on the GeoJSON `location` or `center_point` field:
  ```go
  mongo.IndexModel{
      Keys:    bson.D{{Key: "location", Value: "2dsphere"}},
      Options: options.Index().SetName("idx_places_location_2dsphere"),
  }
  ```
- Text search fields MUST have compound or text indexes for fast matching.

### 3.2 MongoDB Geospatial Functions
- Use `$geoNear` aggregation pipeline for distance calculations and proximity sorting.
- Use `$nearSphere` or `$geoWithin` with `$centerSphere` / `$geometry` Polygons for spherical radius and bounding box filtering.
- Vector tile queries compute WGS84 tile bounding boxes and query with `$geoWithin: { $geometry: { type: "Polygon", ... } }`.

### 3.3 Connection Pool Hygiene
- Always use tuned connection pool parameters from `pkg/database/mongodb.go`:
  - `SetMaxPoolSize(100)`
  - `SetMinPoolSize(10)`
  - `SetMaxConnIdleTime(5 * time.Minute)`
  - `SetTimeout(15 * time.Second)`
- Never create ad-hoc database connections inside HTTP handlers. Always inject `*mongo.Database`.

---

## 4. 🛡️ Security & Authentication Standards

### 4.1 Cryptographic Randomness
- All OTPs and security tokens MUST use `crypto/rand` (cryptographically secure pseudorandom numbers) rather than `math/rand`.

### 4.2 Replay Attack Prevention
- OTPs in Redis MUST have a short Time-To-Live (5 minutes) and MUST be deleted atomically (`redis.Del`) the moment verification succeeds.

### 4.3 Input Validation & Sanitization
- All HTTP inputs must be validated using Gin / validator binding tags (`binding:"required,email"`, `validate:"required"`).
- Coordinate inputs must be validated within valid geographic bounds:
  - Latitude: $[-90.0, 90.0]$
  - Longitude: $[-180.0, 180.0]$

### 4.4 Rate Limiting & OWASP Headers
- All public endpoints must pass through the Token Bucket Rate Limiter middleware (`pkg/middleware/rate_limiter.go`).
- OWASP security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`) must remain enabled on all responses.

---

## 5. 🧪 Testing & CI/CD Guidelines

### 5.1 Unit & Integration Testing
- Every new engine or service MUST have accompanying unit tests in `<package>_test.go`.
- Unit tests must be fast, deterministic, and runnable with `go test -v ./...`.
- Code changes must never break existing test suites (`go test ./...` must exit with code 0).

### 5.2 Commit & Git Hygiene
- Follow Conventional Commits format:
  - `feat(routes): implement Contraction Hierarchies pathfinding`
  - `fix(traffic): resolve sliding window speed calculation jitter`
  - `perf(tiles): add L1 LRU cache for MVT vector tiles`
  - `test(v2x): add GLOSA speed advisory unit tests`
