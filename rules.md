# 📜 B-Map Platform Engineering & Operational Rules

> **System Rules, Architectural Constraints, Security Policies & Domain Standards**  
> *Target System:* B-Map Navigation Backend | *Enforcement:* Automated via CI/CD, Linters, Middleware & Runtime Guards

---

## 1. Core Engineering & Code Quality Rules

### Rule 1.1: Coordinate Representation & Ordering
- **CRITICAL**: All geospatial coordinates in the platform **MUST ALWAYS** follow the standard GeoJSON specification:  
  `[longitude, latitude]` (X, Y) — **NEVER** `[latitude, longitude]`.
- **MongoDB Enforcement**: MongoDB `2dsphere` indexes strictly require `[longitude, latitude]`. Swapping coordinates will cause MongoDB `$near` and `$geoWithin` queries to fail or return corrupted spatial results.
- **API Inputs**: External APIs accepting separate query params (`latitude` and `longitude`) must be parsed and stored internally as `[Number(lon), Number(lat)]`.

### Rule 1.2: Standardized API Response Envelopes
All REST endpoints must return predictable, typed JSON responses:
```typescript
// Successful Response Envelope
{
  "success": true,
  "statusCode": 200, // 200, 201
  "message": "Resource retrieved successfully",
  "data": { ... }
}

// Error Response Envelope
{
  "success": false,
  "statusCode": 400, // 400, 401, 403, 404, 429, 500
  "message": "Human-readable error description",
  "errors": [ ... ] // Optional Zod validation issues
}
```

### Rule 1.3: TypeScript & Build Constraints
- The project is compiled via `tsconfig.json` targeting **CommonJS** (`"module": "commonjs"`, `"target": "es2022"`).
- All source code must pass `npm run lint` (`tsc --noEmit`) with **0 errors**.
- Do not import ECMAScript module syntax dynamically inside commonjs output without verified loaders.

---

## 2. Cybersecurity & Defensive Coding Rules

### Rule 2.1: Secret Management & Zero-Hardcoded Credentials
- **MANDATORY**: Never hardcode live secrets, database passwords, API tokens, or SMTP keys as default values in code schemas (`env.config.ts`).
- Production configurations must fail fast if required environment variables are absent from `.env`.
- The `.env` file must remain permanently listed in `.gitignore`.

### Rule 2.2: Rate Limiting Enforcement
- **Authentication & OTP Routes**: Must pass through `authRateLimiter`:
  - **Window**: 15 minutes.
  - **Maximum Requests**: 15 per IP address.
  - **Violation Response**: `HTTP 429 Too Many Requests`.
- **Public & High-Frequency Routes**: Must pass through `apiRateLimiter`:
  - **Window**: 1 minute.
  - **Maximum Requests**: 300 per client IP.
  - **Exemptions**: `/health` and `/api/v1/health` probes only.

### Rule 2.3: JWT Authentication & Algorithm Pinning
- All JWT tokens must be signed using `HS256`.
- Token verification must explicitly specify `algorithms: ['HS256']` to prevent algorithm confusion or none-cipher bypass vectors.
- Access tokens must be transmitted via `Authorization: Bearer <token>` headers. Query string tokens (`?token=...`) are prohibited in production APIs and, if accepted in web portals, must be stripped immediately from `window.location` via `history.replaceState()`.

### Rule 2.4: Regular Expression Denial of Service (ReDoS) Defense
- **MANDATORY**: Any user-supplied string passed into a `new RegExp(...)` or MongoDB `$regex` query **MUST** be sanitized using `escapeRegExp(input)` from `src/core/utils/security.utils.ts`.
- Direct unescaped evaluation of user strings in RegExp constructors is strictly prohibited.

### Rule 2.5: Cross-Site Scripting (XSS) Sanitization
- In all HTML templates (including the Admin Web Portal at `admin.dashboard.view.ts`), user-supplied values (names, emails, descriptions, notes) must be entity-encoded using `escapeHtml()`.
- Never inject unescaped raw strings into `.innerHTML`.

### Rule 2.6: Request Body Limits
- Global JSON body parser limit is restricted to **1MB** (`express.json({ limit: '1mb' })`).
- Large media upload endpoints must declare separate multi-part streaming limiters.

---

## 3. Navigation & Real-Time Telematics Rules

### Rule 3.1: Off-Route Detection & Thresholds
- **Threshold**: When a vehicle's perpendicular distance from the active polyline (Cross-Track Error) exceeds **40 meters** (`OFF_ROUTE_THRESHOLD_METERS`), the session enters `OFF_ROUTE` state.
- **Reroute Cooldown**: To prevent thrashing under noisy GPS conditions, dynamic recalculations are rate-limited to a cooldown period of **5 seconds** (`REROUTE_COOLDOWN_SECONDS`).
- **Notification**: When rerouting is triggered, an `off_route_alert` and updated route geometry are pushed immediately via Socket.IO.

### Rule 3.2: Real-Time Telematics Ingestion
- **Update Frequency**: Mobile clients stream GPS location updates at **1Hz (1 update/sec)** during active driving, and **0.2Hz (every 5s)** in background/idle states.
- **Accuracy Filter**: Location fixes with horizontal accuracy dilution > 50 meters must be flagged as `LOW_ACCURACY` and excluded from route snapping.
- **Socket.IO Room Scoping**:
  - Telematics broadcasts must be scoped strictly to designated rooms: `nav:<sessionId>` or `driver:<driverId>`.
  - Global broadcast of driver positions is strictly prohibited to maintain user privacy.

---

## 4. Sovereign Indian GIS & Regulatory Rules

### Rule 4.1: Subcontinental Bounding Box Constraints
- Valid coordinates for Indian navigation services must fall within the sovereign geofencing polygon:
  - **Latitude Range**: `6.0° N` to `37.5° N`
  - **Longitude Range**: `68.0° E` to `97.5° E`
- Points outside this bounding box must trigger an informational `OUT_OF_BOUNDS_WARNING`.

### Rule 4.2: DigiPIN Encoding Standards
- DigiPIN is a 10-character alphanumeric digital addressing code dividing India into a **4m × 4m** hierarchical grid.
- Characters used: Numbers `2-9` and letters excluding easily confused glyphs (`0, 1, O, I` are omitted).
- A valid DigiPIN string must match the pattern `/^[2-9A-HJ-NP-Z]{10}$/`.

### Rule 4.3: Sensitive Defense Area Obfuscation
- In compliance with national mapping and security guidelines, locations within military garrisons, nuclear facilities, and sensitive border zones must be obfuscated.
- Requests within designated defense polygons must apply random spatial jitter (radius 200m–500m) or return `RESTRICTED_AIRSPACE_WARNING` when queried for street-level imagery.

### Rule 4.4: FASTag Vehicle Classification Rules
Toll computations must strictly map vehicle categories to standard NHAI FASTag vehicle classes:
- **Class 4**: Car / Jeep / Van / Tata Ace / Light Motor Vehicle
- **Class 5**: Light Commercial Vehicle (LCV) / Mini-Bus
- **Class 6**: 2-Axle Bus / 2-Axle Commercial Truck
- **Class 7**: 3-Axle Commercial Vehicle
- **Class 8**: Heavy Construction Machinery (HCM) / Multi-Axle Vehicle (MAV) / 4-to-6 Axles
- **Class 9**: Oversized Cargo Vehicle (7 or more axles)

### Rule 4.5: Vernacular Voice Translation
Voice maneuvers must support real-time localization across the 12 scheduled Indian languages:
`['hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'en']`.

---

## 5. Database, Caching & Fallback Rules

### Rule 5.1: Redis Caching Strategy
- **Route Key Format**: `bmap:route:<profile>:<origin_lon,lat>:<dest_lon,lat>:<hash(waypoints)>`
- **Route TTL**: Cache entries expire after **3600 seconds (1 hour)**.
- **Geospatial Proximity**: Driver live positions use Redis `GEOADD` on key `bmap:drivers:geo` with an automatic expiry of 60 seconds per position fix.
- **OTP Records**: Stored on key `bmap:otp:<type>:<email>` with a strict TTL of **300 seconds (5 minutes)**.

### Rule 5.2: In-Memory Offline Fallback
- If MongoDB or Redis disconnects or encounters DNS failures (`ECONNREFUSED`), endpoints **MUST NOT crash** or return generic 500 errors.
- Services must gracefully catch storage exceptions and serve responses from local in-memory fallback collections containing calibrated seeds (e.g. major expressways, seed POIs, local beacon maps).
- The HTTP response header or data payload must indicate `"offlineFallback": true` to inform client telemetry.

---

## 6. Authentication & User Lifecycle Rules

### Rule 6.1: Registration Data Contract
- **Name**: 2 to 100 characters, trimmed.
- **Age**: Integer between 1 and 120.
- **Email**: Normalized to lowercase, trimmed, valid RFC 5322 format.
- **Phone Number**: International or 10-digit Indian standard (`+91` or `0` prefix accepted).

### Rule 6.2: Passwordless OTP Lifecycle
- **Length & Type**: Exactly 6 numeric digits generated using cryptographically secure PRNG (`crypto.randomInt(100000, 1000000)`).
- **Expiry**: 5 minutes (`OTP_EXPIRY_MINUTES = 5`).
- **Resend Cooldown**: Strict **30-second cooldown** between consecutive OTP requests for the same email.
- **Brute-Force Lockout**: A maximum of **3 failed attempts** is permitted. On the 3rd failed attempt, the OTP is permanently invalidated from storage.
- **Replay Protection**: Successful verification must immediately delete the OTP record from Redis/memory.

---

## 7. Role-Based Access Control (RBAC) Rules

| User Role | Permitted Actions | Restricted Endpoints |
| :--- | :--- | :--- |
| **Anonymous / Public** | Health checks, directions calculation, nearby POI search, map tiles, OTP registration/login | `/api/v1/auth/me`, `/api/v1/admin/*`, live tracking dispatch |
| **Authenticated User (`role: user`)** | Active navigation sessions, profile updates, hazard reporting, SOS distress triggers, ratings | `/api/v1/admin/*` (All administrative endpoints) |
| **Administrator (`role: admin`)** | Full read/write access to system configuration, user moderation, traffic/weather overrides, audit logs | None |
