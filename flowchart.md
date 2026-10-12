# 🔄 B-Map Platform Complete System Flowcharts

> **Visual Architectural Workflows, State Machines & Event Sequence Diagrams**  
> *Target System:* B-Map Navigation Backend | *Diagrams:* Interactive Mermaid Graphs

---

## 1. End-to-End Turn-by-Turn Navigation & Dynamic Rerouting Flow

This diagram illustrates the lifecycle of a driver from initial route computation through active tracking, off-route cross-track error detection, and automatic reroute push.

```mermaid
flowchart TD
    Start([User Initiates Navigation]) --> InputCoords[User Inputs Origin & Destination]
    InputCoords --> CheckCache{Check Redis Route Cache}

    CheckCache -->|Cache Hit| ReturnRoute[Return Cached Polyline & Turn Steps]
    CheckCache -->|Cache Miss| QueryOSRM[Request Directions from OSRM Engine]
    QueryOSRM --> StoreCache[Store Route in Redis with 1h TTL]
    StoreCache --> ReturnRoute

    ReturnRoute --> StartSession[Client Calls POST /navigation/start]
    StartSession --> OpenSocket[Client Joins Socket.IO Room: nav:sessionId]

    OpenSocket --> StreamGPS[Client Streams GPS Fix at 1Hz]
    StreamGPS --> CalcXTD[Compute Cross-Track Error XTD & Along-Track Distance]

    CalcXTD --> CheckOffRoute{Is XTD > 40m?}

    CheckOffRoute -->|No: On Route| UpdateHUD[Update HUD: Step Progress, ETA, Bearing]
    UpdateHUD --> CheckDestination{Reached Destination?}
    CheckDestination -->|No| StreamGPS
    CheckDestination -->|Yes| FinishNav([Navigation Complete])

    CheckOffRoute -->|Yes: Off Route| CheckCooldown{Has 5s Cooldown Elapsed?}
    CheckCooldown -->|No: In Cooldown| SuppressJitter[Suppress Reroute - Retain State]
    SuppressJitter --> StreamGPS

    CheckCooldown -->|Yes: Trigger Reroute| RecalculateOSRM[Calculate New Route from Current GPS]
    RecalculateOSRM --> SocketPush[Emit 'reroute_push' via Socket.IO]
    SocketPush --> UpdateClientHUD[Client Replaces Active Polyline & Recalculates Steps]
    UpdateClientHUD --> StreamGPS
```

---

## 2. Passwordless User Registration & Email OTP State Machine

This state machine details how users register with their Name, Age, Email, and Phone Number, and how the OTP verification prevents replay and brute-force attacks.

```mermaid
stateDiagram-v2
    [*] --> Unregistered: User Submits Name, Age, Email, Phone
    Unregistered --> ValidatingInput: Validate Zod Schema (age 1-120, email format)

    ValidatingInput --> RejectedInput: Invalid Input (HTTP 400)
    RejectedInput --> [*]

    ValidatingInput --> GeneratingOTP: Valid Input
    GeneratingOTP --> SendingEmail: CSPRNG Generates 6-Digit Code
    SendingEmail --> OTPSentState: Gmail TLS SMTP Dispatches Code (HTTP 201)

    state OTPSentState {
        [*] --> WaitingForUser
        WaitingForUser --> CheckCooldown: User Requests Resend
        CheckCooldown --> ResendBlocked: < 30s elapsed (HTTP 400)
        CheckCooldown --> ResendAllowed: >= 30s elapsed -> New OTP Sent

        WaitingForUser --> VerifyingCode: User Submits 6-Digit Code
        VerifyingCode --> CodeExpired: Time > 5 minutes (HTTP 400)
        VerifyingCode --> IncorrectCode: Code Mismatch
        IncorrectCode --> LockoutCheck: Increment attempts count

        LockoutCheck --> AttemptsExceeded: Attempts >= 3 -> Invalidate OTP (HTTP 400)
        LockoutCheck --> RetryPermitted: Attempts < 3 -> Prompt remaining attempts

        VerifyingCode --> CodeCorrect: Code Matches
    }

    AttemptsExceeded --> [*]
    CodeCorrect --> SessionActive: Activate User in DB & Issue HS256 JWT
    SessionActive --> [*]
```

---

## 3. NavIC / Multi-Sensor Positioning & Fallback Hierarchy

This diagram maps how raw satellite and telematics signals are synthesized through ISRO NavIC dual-frequency corrections and local sensor fusion.

```mermaid
flowchart TD
    Sensors([Inbound Positioning Telemetry]) --> SplitStreams{Identify Signal Types}

    SplitStreams -->|NavIC Satellite| IngestNavIC[Ingest NavIC L5: 1176.45MHz & S-Band: 2492.028MHz]
    SplitStreams -->|GPS Satellite| IngestGPS[Ingest Standard GPS L1 Signals]
    SplitStreams -->|Indoor Beacons| IngestBLE[Ingest Bluetooth BLE Beacon RSSI Packets]
    SplitStreams -->|Inertial IMU| IngestIMU[Ingest Accelerometer & Gyroscope Data]

    IngestNavIC --> DualFreqCancel[Compute Ionosphere-Free Linear Combination P_IF]
    DualFreqCancel --> ComputeDOP[Evaluate Dilution of Precision HDOP & Satellite Count]

    ComputeDOP --> CheckNavICQuality{HDOP < 1.8 & Sats >= 4?}

    CheckNavICQuality -->|Yes: High Precision| NavICFix[Primary Fix: ISRO NavIC Sub-Meter Fix]
    CheckNavICQuality -->|No: Degraded Satellites| FallbackGPS[Secondary Fix: GPS + EGNOS Augmentation]

    IngestBLE --> BLETrilateration[Log-Distance RSSI Weighted Multilateration]
    BLETrilateration --> CheckIndoor{Strong BLE Signal?}
    CheckIndoor -->|Yes| IndoorFix[Indoor Facility & Floor Level Fix]

    NavICFix --> SensorFusion[Extended Kalman Filter / Dead Reckoning Fusion]
    FallbackGPS --> SensorFusion
    IndoorFix --> SensorFusion
    IngestIMU --> SensorFusion

    SensorFusion --> HighAccuracyFix([High-Accuracy Snapped Position Output])
```

---

## 4. Real-Time Telematics & Socket.IO Room Broadcast Architecture

This diagram shows how high-frequency driver locations are ingested into Redis and broadcast to passenger and fleet monitoring clients.

```mermaid
sequenceDiagram
    autonumber
    participant Driver as Driver Mobile App
    participant Gateway as Ingress API & Rate Limiter
    participant Tracking as Tracking Service
    participant Redis as Redis Cache (GEOADD)
    participant Socket as Socket.IO Server
    participant Rider as Rider / Passenger Client
    participant Fleet as Fleet Monitoring Console

    Rider->>Socket: Connect & Join Room 'driver:drv_101'
    Fleet->>Socket: Connect & Join Room 'fleet:delhi_zone'

    loop Every 1 Second (1Hz Telematics)
        Driver->>Gateway: POST /api/v1/tracking/update (Coords, Speed, Bearing)
        Gateway->>Tracking: Forward Payload
        Tracking->>Redis: GEOADD bmap:drivers:geo lon lat drv_101 (TTL 60s)
        Tracking->>Socket: Broadcast to Room 'driver:drv_101'
        Socket-->>Rider: Emit 'driver_location_update' (Smooth Marker Interpolation)
        Socket-->>Fleet: Emit 'fleet_telemetry_feed'
    end

    Note over Rider, Fleet: Sub-50ms latency across connected WebSocket clients
```

---

## 5. DigiPIN 4m × 4m National Hierarchical Grid Encoding Flow

This diagram shows how any geographic coordinate in India is resolved into an official 10-character alphanumeric digital address.

```mermaid
flowchart TD
    StartCoords([Input Latitude & Longitude]) --> CheckBounds{Within India Bounding Box? Lat: 6-38N, Lon: 68-100E}

    CheckBounds -->|No| OutOfBounds[Return Bounding Box Error]
    CheckBounds -->|Yes| Normalize[Normalize to Unit Matrix [0, 1]]

    Normalize --> InitGrid[Initialize Tier = 1, Output = '']

    InitGrid --> LoopTier{Tier <= 10?}

    LoopTier -->|Yes| Subdivide[Subdivide Active Cell into 32 Sub-Quadrants]
    Subdivide --> MapIndices[Map Relative Coordinates to Row r & Column c]
    MapIndices --> LookupAlphabet[Character = DigiPIN_Alphabet 2-9, A-Z excl. 0,1,O,I]
    LookupAlphabet --> AppendChar[Output += Character]
    AppendChar --> RefineBox[Contract Bounding Box to Selected Cell]
    RefineBox --> IncrementTier[Tier = Tier + 1]
    IncrementTier --> LoopTier

    LoopTier -->|No: Tier = 10 reached| FinalDigiPIN[Format 10-Character String: e.g. 28J4-K8M2-9P]
    FinalDigiPIN --> ReturnResult([Return 4m x 4m Precise Cell & Centroid])
```

---

## 6. Emergency SOS Distress Trigger & Proximity Dispatch Flow

This flowchart illustrates the critical life-safety flow when a motorist or pedestrian triggers an emergency SOS alert.

```mermaid
flowchart TD
    SOS([Driver Hits SOS Distress Button]) --> CaptureContext[Capture Current GPS, Speed, Active Route & Vehicle Profile]
    CaptureContext --> SendAlert[POST /api/v1/emergency/sos]

    SendAlert --> PersistIncident[(Store Incident in MongoDB SOS Incident Record)]
    PersistIncident --> QueryResponders[Redis GEOSEARCH: Find Nearest Units within 15km]

    QueryResponders --> IdentifyUnits{Identify Responder Classes}

    IdentifyUnits --> Ambulance[Nearest Ambulances & Trauma Centers]
    IdentifyUnits --> Police[Highway Patrol & Police Stations 112]
    IdentifyUnits --> Fire[Fire & Rescue Units]

    Ambulance --> PushAlert[Socket.IO Instant Emergency Broadcast]
    Police --> PushAlert
    Fire --> PushAlert

    PushAlert --> AdminConsole[Admin Emergency Console Audio & Red Visual Alarm]
    AdminConsole --> DispatchConfirmed[Admin / System Dispatches Nearest Unit]

    DispatchConfirmed --> PushETA[Send Live Responder ETA & Tracking to Distressed Driver]
    PushETA --> StatusActive([Incident Status: IN_PROGRESS])
```

---

## 7. Administrative Traffic & Weather Override Broadcast Pipeline

This diagram shows how administrators inject manual hazard advisories or severe weather warnings that instantly update navigation routes.

```mermaid
flowchart TD
    Admin[Admin on Web Dashboard: /admin/dashboard] --> ChooseOverride{Select Override Action}

    ChooseOverride -->|Traffic Congestion| TrafficForm[Fill Corridor Name, Speed Limit, Reason]
    ChooseOverride -->|Severe Weather| WeatherForm[Select Highway, Alert Level: RED/ORANGE, IMD Advisory]

    TrafficForm --> SubmitTraffic[POST /api/v1/admin/traffic/override]
    WeatherForm --> SubmitWeather[POST /api/v1/admin/weather/override]

    SubmitTraffic --> AuthCheck{Verify JWT & Role: Admin}
    SubmitWeather --> AuthCheck

    AuthCheck -->|Unauthorized| Reject[Return HTTP 403 Forbidden]
    AuthCheck -->|Authorized| SaveDB[(Update MongoDB & SystemConfig)]

    SaveDB --> FlushCache[Flush Impacted Redis Route Cache Keys]
    FlushCache --> LogAudit[(Record Immutable Cryptographic Admin Audit Log)]

    LogAudit --> SocketBroadcast[Socket.IO Emits 'highway_advisory_alert' Globally]
    SocketBroadcast --> ActiveDrivers[All Vehicles on Corridor Receive Voice & HUD Alert]
    ActiveDrivers --> AutoReroute[Background Reroute Evaluated to Bypass Obstacle]
```

---

## 8. High-Availability Storage & In-Memory Offline Fallback Flow

This flowchart illustrates the fault-tolerant in-memory fallback pattern that protects the platform against database outages and DNS resolution errors.

```mermaid
flowchart TD
    APIRequest([Inbound API Request: e.g. /places/nearby or /admin/users]) --> CheckDBState{Check MongoDB Connection readyState === 1}

    CheckDBState -->|Connected| ExecuteMongo[Execute Primary Mongoose Query with 2dsphere Index]

    ExecuteMongo --> MongoSuccess{Query Succeeded?}

    MongoSuccess -->|Yes| FormatStandard[Format Standard Response with Database Documents]
    MongoSuccess -->|No: Error / Timeout| LogWarn[Log Warning via Winston Logger]

    CheckDBState -->|Disconnected / Refused| LogWarn

    LogWarn --> CheckMemFallback{Check In-Memory Fallback Store}

    CheckMemFallback -->|Seed Data Available| QueryMem[Query Seed Indian POIs, Expressways, Seed Records]
    QueryMem --> FormatFallback[Format Response: Set 'offlineFallback': true]

    CheckMemFallback -->|No Seed Data| SafeEmpty[Return Safe Empty Envelope: success: true, count: 0]

    FormatStandard --> ReturnHTTP([HTTP 200 OK Response])
    FormatFallback --> ReturnHTTP
    SafeEmpty --> ReturnHTTP
```
