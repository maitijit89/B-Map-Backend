# 📜 B-Map Platform Engineering & Operational Rules

> **System Rules, Architectural Constraints, Security Policies, Kinematic Bounds & Domain Standards**  
> *Target System:* B-Map Navigation & Telematics Backend | *Version:* 2.0.0 | *Enforcement:* Automated via CI/CD, Linters, Runtime Guards & Middleware

---

## 1. Core Geospatial & Coordinate Engineering Rules

### Rule 1.1: Coordinate Representation & Ordering
- **CRITICAL**: All geospatial coordinates in the platform **MUST ALWAYS** follow the standard GeoJSON specification:  
  `[longitude, latitude]` (X, Y) — **NEVER** `[latitude, longitude]`.
- **MongoDB 2dsphere Enforcement**: MongoDB geospatial indexes strictly require `[longitude, latitude]`. Swapping coordinates will cause MongoDB `$near`, `$geoWithin`, and `$geoIntersects` queries to fail or return inverted geographic positions.
- **API Inputs**: External endpoints accepting individual query parameters (`latitude` and `longitude`) must be parsed and stored internally as `[Number(lon), Number(lat)]`.

### Rule 1.2: Sovereign Subcontinental Bounding Box Constraints
- Coordinates for Indian navigation services must reside within the sovereign geographic bounding envelope:
  - **Latitude Range**: `6.0° N` to `37.5° N`
  - **Longitude Range**: `68.0° E` to `97.5° E`
- Points outside this bounding box must trigger an informational `OUT_OF_BOUNDS_WARNING` in response metadata.

### Rule 1.3: Standardized API Response Envelopes
All REST endpoints must return typed, predictable JSON responses conforming to the following contracts:
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
  "errors": [ ... ] // Optional Zod schema validation errors
}
```

### Rule 1.4: TypeScript & Compilation Constraints
- The project compiles via `tsconfig.json` targeting **CommonJS** (`"module": "commonjs"`, `"target": "es2022"`).
- All source code must pass `npm run lint` (`tsc --noEmit`) with **0 errors and 0 warnings**.
- Dynamic ES Module imports without verified loaders inside CommonJS outputs are strictly prohibited.

---

## 2. Cybersecurity & Zero-Trust Defense Policies

### Rule 2.1: Secret Management & Zero-Hardcoded Credentials
- **MANDATORY**: Never hardcode live secrets, database connection URIs, API tokens, or SMTP passwords into code schemas (`env.config.ts`).
- Production configurations must fail fast during startup if required environment variables are absent from `.env`.
- The `.env` file must remain permanently listed in `.gitignore`.

### Rule 2.2: Dual-Tier Rate Limiting Enforcement
- **Authentication & OTP Routes**: Must pass through `authRateLimiter`:
  - **Window**: 15 minutes.
  - **Maximum Requests**: 15 per IP address.
  - **Violation Response**: `HTTP 429 Too Many Requests`.
- **Public & High-Frequency Routes**: Must pass through `apiRateLimiter`:
  - **Window**: 1 minute.
  - **Maximum Requests**: 300 per client IP.
  - **Exemptions**: `/health` and `/api/v1/health` probes only.

### Rule 2.3: JWT Authentication & Algorithm Pinning
- All JWT access tokens must be signed using `HS256`.
- Token verification must explicitly assert `algorithms: ['HS256']` to prevent algorithm-downgrade or none-cipher bypass attacks.
- Access tokens must be transmitted via `Authorization: Bearer <token>` headers. Query string tokens (`?token=...`) are prohibited in production APIs.

### Rule 2.4: Anti-Reconnaissance & Scanner Trap Rules
- Requests probing for automated exploit paths (e.g., `/.env`, `/wp-admin`, `/.git`, `/phpmyadmin`) must be intercepted immediately by `antiReconTrap` and dropped without revealing stack traces.

### Rule 2.5: NoSQL Query Injection Sanitization
- All incoming request bodies, query strings, and URL parameters must pass through `noSqlSanitizer` before reaching controllers.
- Any object key starting with `$` (MongoDB operators such as `$gt`, `$ne`, `$where`) or containing nested dot notation must be stripped to eliminate query selector injection.

### Rule 2.6: Regular Expression Denial of Service (ReDoS) Defense
- **MANDATORY**: Any user-supplied string passed into a `new RegExp(...)` or MongoDB `$regex` query **MUST** be sanitized using `escapeRegExp(input)` from `src/core/utils/security.utils.ts`.
- Direct unescaped evaluation of user strings in RegExp constructors is strictly forbidden.

### Rule 2.7: Cross-Site Scripting (XSS) Sanitization
- In all HTML templates (including the Admin Web Portal at `admin.dashboard.view.ts`), user-supplied values (names, emails, descriptions, notes) must be entity-encoded using `escapeHtml()`.
- Never inject unescaped raw strings into `.innerHTML`.

### Rule 2.8: Request Body & Payload Limits
- Global JSON body parser limit is restricted to **1MB** (`express.json({ limit: '1mb' })`).
- Multi-part file or photo upload endpoints must declare separate streaming limiters.

---

## 3. Telemetry Integrity, Cryptographic Signing & Anti-Replay Rules

### Rule 3.1: Cryptographic Telemetry Request Signing
- All high-frequency vehicle telemetry streams transmitted over HTTP must include cryptographic proof of authenticity in request headers:
  - `X-BMap-Signature`: Hex-encoded $\text{HMAC-SHA256}(SecretKey, \text{Timestamp} + ":" + \text{Nonce} + ":" + \text{Payload})$
  - `X-BMap-Timestamp`: Client epoch timestamp in milliseconds
  - `X-BMap-Nonce`: Unique cryptographic nonce (minimum 16 bytes)
- Telemetry requests lacking these headers or failing signature verification must be rejected immediately with `HTTP 401 Unauthorized`.

### Rule 3.2: Anti-Replay Freshness & Nonce Cache
- **Tolerance Window**: Incoming telemetry timestamps must fall within **45 seconds** of server time ($|T_{server} - T_{client}| \le 45,000 \text{ ms}$). Requests outside this window must be rejected as stale.
- **Nonce Deduplication**: Nonces must be checked against an in-memory sliding cache. A duplicate nonce received within the 45-second window must be rejected with `NONCE_REPLAY_DETECTED`.

---

## 4. Anti-GPS Spoofing & Kinematic Plausibility Rules

### Rule 4.1: Kinematic Physics Plausibility Bounds
Incoming GPS telemetry points must be validated against real-world physical constraints:
- **Maximum Physical Acceleration**: $a \le 6.5 \text{ m/s}^2$ ($\approx 0.66g$, theoretical ceiling for civilian surface road vehicles). Telemetry exhibiting instantaneous acceleration $> 6.5 \text{ m/s}^2$ must be flagged as `IMPOSSIBLE_ACCELERATION`.
- **Maximum Plausible Speed**: Speed must not exceed $220.0 \text{ km/h}$. Teleportation jumps exceeding this threshold must be rejected with `TELEPORTATION_ANOMALY`.
- **Bearing vs. Displacement Concordance**: The angular difference between the displacement vector bearing and the device's reported heading must not exceed **$70.0^\circ$** at speeds $> 15 \text{ km/h}$. Discrepancies $> 70^\circ$ indicate synthetic coordinate injection (`BEARING_DISPLACEMENT_MISMATCH`).
- **Spatial Micro-Entropy Gating**: Real GNSS receivers exhibit natural atmospheric and multipath jitter. Synthetic emulators producing perfectly static or linearly interpolated fixes with spatial variance $\sigma^2 < 10^{-9}$ must be rejected as `SYNTHETIC_ZERO_JITTER`.
- **Mock Location Flags**: Any telemetry frame reporting Android `isFromMockProvider = true` must be flagged immediately as `MOCK_LOCATION_FLAG` and excluded from crowdsourced traffic updates.

---

## 5. Extended Kalman Filter (EKF) & Sensor Fusion Rules

### Rule 5.1: 6-State Continuous-Time Kinematic Model
- Telematics smoothing must utilize a 6-state vector:
  $$\mathbf{x} = \begin{bmatrix} x & y & v_x & v_y & a_x & a_y \end{bmatrix}^T$$
- **Process Noise Variance**: Acceleration noise variance must default to $q_{accel} = 1.8 \text{ m/s}^2$.
- State propagation must use local metric Cartesian coordinates (Easting/Northing relative to a local tangent origin).

### Rule 5.2: Measurement Covariance Gating
- Measurement noise covariance matrix $\mathbf{R}$ must account for GPS sensor characteristics:
  - Position variance: $\sigma_p^2 = 16.0 \text{ m}^2$ (standard GPS $4\text{m}$ error radius).
  - Velocity variance: $\sigma_v^2 = 0.64 \text{ (m/s)}^2$ ($\approx 0.8 \text{ m/s}$ Doppler error).
- Fixes with reported horizontal dilution of precision (HDOP) $> 50 \text{ meters}$ must scale $\mathbf{R}$ accordingly or be excluded from state correction.

### Rule 5.3: Dead Reckoning Extrapolation Limits
- When GPS satellite signal is lost (e.g. in tunnels or multi-level garages), the EKF may extrapolate the vehicle position using kinematic dead reckoning $\mathbf{x}_{k+1} = \mathbf{F} \mathbf{x}_k$.
- **Extrapolation Duration Limit**: Dead reckoning is permitted for a maximum of **10.0 seconds** (10 consecutive 1Hz frames). Beyond 10 seconds, the filter must flag `UNCERTAINTY_EXCEEDED` and suspend route snapping until a valid GNSS fix is acquired.

---

## 6. Real-Time Traffic Graph & Dynamic ETA Rules

### Rule 6.1: Edge Weight Invariance in Road Graph
- **CRITICAL**: Road segment edges in the directed graph **MUST STRICTLY STORE AND CALCULATE WEIGHTS IN TRAVEL TIME MINUTES**, never static distance:
  $$W_{minutes} = \frac{\text{Length}_{km}}{\text{Speed}_{km/h}} \times 60$$
- Shortest-path search algorithms (Dijkstra / A*) must optimize for minimum travel time minutes to deliver dynamic congestion-aware ETAs.

### Rule 6.2: Bureau of Public Roads (BPR) Congestion Exponents
- Dynamic edge travel times must be re-weighted according to the BPR formulation:
  $$T = T_{free} \times \left(1 + \alpha \cdot \left(\frac{V}{C}\right)^\beta\right)$$
- Calibrated Indian urban constants: $\alpha = 0.65$ and $\beta = 2.0$.
- **Speed Floor**: The effective speed on any segment must never fall below **$5.0 \text{ km/h}$** to prevent infinite travel time singularities during severe traffic jams.

### Rule 6.3: DBSCAN Anomaly Clustering & Outlier Rejection
- To prevent localized false-positive slowdowns (e.g. motorcycles stopped at a roadside tea stall, single parked delivery vans, or pedestrians carrying smartphones):
  - **Epsilon Distance ($\varepsilon$)**: $45 \text{ meters}$.
  - **Minimum Cluster Points ($minPts$)**: $3 \text{ distinct devices}$.
  - **Speed Threshold**: Speed $< 15 \text{ km/h}$.
- An isolated slow or stopped vehicle that does not belong to a cluster of $\ge 3$ devices within $45\text{m}$ must be classified as a localized non-traffic anomaly and discarded from road segment speed degradation.

### Rule 6.4: Diurnal Traffic Prediction Blending
- Traffic prediction models must segment road profiles into **15-minute diurnal windows** across each day of the week (96 time buckets per day).
- When live telemetry is available, the predicted speed must be a weighted blend:
  $$V_{predicted} = (1 - w) \cdot V_{historical} + w \cdot V_{live}$$
  Where $w \in [0.6, 0.9]$ based on the freshness and device density of the live stream.

---

## 7. Macroscopic Traffic Flow & LWR Shockwave Rules

### Rule 7.1: Jam Density & Greenshields Model
- Standard jam density per lane: $k_{jam} = 135.0 \text{ vehicles/km/lane}$.
- Current density estimation from speed:
  $$k = k_{jam} \cdot \left(1 - \frac{v}{v_{free}}\right)$$
- Maximum segment capacity:
  $$q_{capacity} = \frac{v_{free} \cdot k_{jam}}{4} \text{ (vehicles/hour/lane)}$$

### Rule 7.2: Shockwave Boundary Classification & Spillback Alarms
- Shockwave boundary velocity:
  $$w = \frac{q_2 - q_1}{k_2 - k_1} \text{ (km/h)}$$
- **Classification Rules**:
  - $w < -5.0 \text{ km/h}$: `BACKWARD_FORMING` (Congestion queue growing backward toward upstream junctions).
  - $w > +5.0 \text{ km/h}$: `FORWARD_RECOVERY` (Bottleneck cleared; traffic draining).
  - $-5.0 \le w \le +5.0$: `STATIONARY` bottleneck.
- **Upstream Spillback Trigger**: When $w < 0$ and the estimated spillback time to the upstream intersection $t_{spillback} \le 5.0 \text{ minutes}$, an automated `TRAFFIC_CONGESTION_ALERT` must be dispatched via Socket.IO to initiate preemptive rerouting.

---

## 8. Physics-Based Eco-Routing Rules

### Rule 8.1: Vehicle Resistance Constants & Parameters
Eco-routing must compute physical resistive power consumption:
- Air Density: $\rho = 1.225 \text{ kg/m}^3$
- Gravity: $g = 9.81 \text{ m/s}^2$
- Rolling Resistance Power: $P_{roll} = C_{rr} \cdot m \cdot g \cdot v$
- Aerodynamic Drag Power: $P_{aero} = \frac{1}{2} \cdot \rho \cdot C_d \cdot A \cdot v^3$

### Rule 8.2: Powertrain Efficiency & Fuel Coefficients
- **Petrol Internal Combustion Engine (ICE)**:
  - Powertrain efficiency: $\eta = 0.30$
  - Energy density: $34.2 \text{ MJ/Litre}$
  - Idle fuel rate: $0.8 \text{ L/h}$
  - $\text{CO}_2$ emissions: $2,310 \text{ g/Litre}$
- **Diesel ICE**:
  - Powertrain efficiency: $\eta = 0.34$
  - Energy density: $38.6 \text{ MJ/Litre}$
  - Idle fuel rate: $0.6 \text{ L/h}$
  - $\text{CO}_2$ emissions: $2,680 \text{ g/Litre}$
- **Electric Vehicle (EV)**:
  - Powertrain efficiency: $\eta = 0.88$
  - Regenerative braking recovery efficiency: $70\%$ of kinetic braking energy credited back to battery.

---

## 9. Sovereign Indian GIS & Regulatory Rules

### Rule 9.1: DigiPIN Encoding Standards
- DigiPIN is a 10-character alphanumeric digital addressing code dividing India into a **4m × 4m** hierarchical grid.
- Character Set: Digits `2-9` and letters excluding easily confused glyphs (`0, 1, O, I` are omitted).
- **Validation Regex**: A valid DigiPIN string must strictly match `/^[2-9A-HJ-NP-Z]{10}$/`.

### Rule 9.2: NHAI FASTag Vehicle Classification Rules
Toll computations must strictly map vehicle categories to standard NHAI FASTag vehicle classes:
- **Class 4**: Car / Jeep / Van / Tata Ace / Light Motor Vehicle
- **Class 5**: Light Commercial Vehicle (LCV) / Mini-Bus
- **Class 6**: 2-Axle Bus / 2-Axle Commercial Truck
- **Class 7**: 3-Axle Commercial Vehicle
- **Class 8**: Heavy Construction Machinery (HCM) / Multi-Axle Vehicle (MAV) / 4-to-6 Axles
- **Class 9**: Oversized Cargo Vehicle (7 or more axles)

### Rule 9.3: Sensitive Defense Area Polygon Obfuscation
- In compliance with national mapping and security guidelines, locations within military garrisons, defense establishments, nuclear facilities, and sensitive border zones must be obfuscated.
- Coordinates within designated defense polygons must apply random spatial jitter (radius $200\text{m}-500\text{m}$) or return `RESTRICTED_AIRSPACE_WARNING` when queried for street-level views.

### Rule 9.4: Vernacular Voice Translation
Voice maneuvers must support real-time audio localization across the 12 scheduled Indian languages:
`['hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'en']`.

---

## 10. Cryptographic Spatial Proof-of-Presence Rules

### Rule 10.1: Attestation Certificate Data Contract
- A Proof-of-Presence attestation asserts that a device physically occupied a verified geofence boundary at an exact epoch timestamp.
- Attestation certificates must include:
  - `attestationId`: Cryptographic UUID
  - `subjectId`: Driver, vehicle, or device identifier
  - `targetCoordinate`: Centroid `[lon, lat]`
  - `geofenceRadiusMeters`: Permitted radius
  - `actualObservedCoordinate`: Verified GPS coordinate
  - `rawBreadcrumbHash`: SHA-256 digest of raw GNSS measurements
  - `signature`: Hex-encoded HMAC-SHA256 signature
  - `expiresAt`: Epoch millisecond timestamp

### Rule 10.2: Verification & Expiration Policy
- Certificates must expire after **30 minutes** (`TTL = 1800s`).
- Verification via `/api/v1/traffic/security/proof-of-presence/verify` must recompute the HMAC-SHA256 signature over the payload and check timestamp freshness. Tampered or expired certificates must return `isValid: false`.

---

## 11. Runtime Anti-Tamper & Defensive Execution Rules

### Rule 11.1: Deep Prototype Pollution Defense
- At process initialization, `AntiTamperSentinel` must deep-freeze JavaScript built-in prototypes:
  `Object.prototype`, `Array.prototype`, `Function.prototype`, `String.prototype`, `Number.prototype`, `Boolean.prototype`, `Symbol.prototype`, `Promise.prototype`, `Map.prototype`, `Set.prototype`.
- Attempts to mutate prototypes or inject gadget properties must throw a frozen object error.

### Rule 11.2: Dynamic Code Execution Prohibition
- The use of `eval()` or dynamic `new Function(...)` constructs is strictly forbidden across the entire codebase.

### Rule 11.3: Debugger & Inspector Traps
- In production mode (`NODE_ENV === 'production'`), attaching a V8 debugger (`inspector.url() !== undefined`) must trigger an immediate process termination to prevent unauthorized memory inspection and reverse engineering.

---

## 12. Database, Caching & Fallback Resilience Rules

### Rule 12.1: Redis Caching Strategy & Key Formats
- **Route Key**: `bmap:route:<profile>:<origin_lon,lat>:<dest_lon,lat>:<hash(waypoints)>` (TTL: **3600 seconds**).
- **Driver Live Geo**: Redis `GEOADD` on key `bmap:drivers:geo` (TTL: **60 seconds** per position fix).
- **OTP Records**: Key `bmap:otp:<type>:<email>` (TTL: **300 seconds**).

### Rule 12.2: In-Memory Offline Fallback Requirement
- If MongoDB Atlas or Redis encounters DNS failure, connection timeout, or partition (`ECONNREFUSED`), endpoints **MUST NOT crash** or return unhandled 500 errors.
- Domain services must catch storage exceptions gracefully and serve pre-calibrated in-memory fallback datasets (seed POIs, expressways, local maps).
- The HTTP response payload must flag `"offlineFallback": true` to inform client telemetry.

---

## 13. Navigation & Real-Time Telematics Rules

### Rule 13.1: Off-Route Detection & Thresholds
- **Threshold**: When perpendicular distance from the active route polyline (Cross-Track Error) exceeds **40 meters** (`OFF_ROUTE_THRESHOLD_METERS`), the session enters `OFF_ROUTE` state.
- **Reroute Cooldown**: To eliminate route fluttering under noisy GPS fixes, automatic recalculation is rate-limited to a cooldown period of **5 seconds** (`REROUTE_COOLDOWN_SECONDS`).
- **Notification**: When rerouting is triggered, an `off_route_alert` and updated route geometry are dispatched immediately via Socket.IO.

### Rule 13.2: Real-Time Telematics Ingestion Frequencies
- **Update Frequency**: Mobile clients stream GPS location updates at **1Hz (1 update/sec)** during active driving, and **0.2Hz (every 5s)** in background/idle states.
- **Accuracy Filter**: Location fixes with horizontal accuracy dilution $> 50 \text{ meters}$ must be flagged as `LOW_ACCURACY` and excluded from road snapping.
- **Socket.IO Room Scoping**:
  - Telematics broadcasts must be scoped strictly to designated rooms: `nav:<sessionId>`, `driver:<driverId>`, or `segment:<segmentId>`.
  - Global broadcast of driver positions is strictly prohibited to preserve user privacy.

---

## 14. Authentication & Passwordless OTP Lifecycle Rules

### Rule 14.1: Passwordless OTP Lifecycle
- **Length & Generation**: Exactly 6 numeric digits generated using cryptographically secure PRNG (`crypto.randomInt(100000, 1000000)`).
- **Expiry**: 5 minutes (`OTP_EXPIRY_MINUTES = 5`).
- **Resend Cooldown**: Strict **30-second cooldown** between consecutive OTP requests for the same email.
- **Brute-Force Lockout**: A maximum of **3 failed verification attempts** is permitted. On the 3rd failed attempt, the OTP is permanently invalidated.
- **Single-Use Replay Protection**: Successful verification must immediately delete the OTP record from Redis/memory.

### Rule 14.2: Registration Data Contract
- **Name**: 2 to 100 characters, trimmed.
- **Age**: Integer between 1 and 120.
- **Email**: Normalized to lowercase, trimmed, valid RFC 5322 format.
- **Phone Number**: International or 10-digit Indian standard (`+91` or `0` prefix accepted).

---

## 15. Role-Based Access Control (RBAC) Matrix

| User Role | Permitted Actions | Restricted Endpoints |
| :--- | :--- | :--- |
| **Anonymous / Public** | Health checks, directions calculation, nearby POI search, map tiles, OTP registration/login, public traffic segments | `/api/v1/auth/me`, `/api/v1/admin/*`, live tracking dispatch |
| **Authenticated User (`role: user`)** | Active navigation sessions, profile updates, hazard reporting, SOS distress triggers, ratings, telematics streaming | `/api/v1/admin/*` (All administrative endpoints) |
| **Administrator (`role: admin`)** | Full read/write access to system configuration, user moderation, traffic/weather overrides, audit logs | None |
