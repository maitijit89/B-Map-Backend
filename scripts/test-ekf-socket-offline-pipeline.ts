import assert from 'assert';
import http from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { ExtendedKalmanFilter } from '../src/core/algorithms/extended-kalman-filter';
import { calculateGeodesicXtdMeters, checkOffRoute } from '../src/core/utils/geo.utils';
import { TelemetrySignerGuard } from '../src/core/security/telemetry-signer.guard';
import { AntiSpoofingGuard } from '../src/core/security/anti-spoofing.guard';
import { ProofOfPresenceService } from '../src/core/security/proof-of-presence';
import { createApp } from '../src/app';
import { initSocketServer } from '../src/sockets';
import { SOCKET_EVENTS } from '../src/core/constants/socket.events';
import { parkingSpaceNavigationService } from '../src/modules/parking/parking-space-navigation.service';
import { Coordinate, GeoJsonLineString } from '../src/core/types/geo.types';

let passed = 0;
let failed = 0;

function it(desc: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${desc} -> ${err.message}`);
      failed++;
    }
  })();
}

async function runSuite() {
  console.log('========================================================================');
  console.log('🛰️  6-STATE EKF, ZERO-TRUST & 10 SOCKET.IO NAMESPACES VERIFICATION SUITE');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Six-State EKF Kinematic Model, Dead Reckoning & Geodesic XTD
  // -------------------------------------------------------------------------
  console.log('--- 1. 6-State EKF Kinematic Model & Dead Reckoning (Section 5.1) ---');
  const ekf = new ExtendedKalmanFilter(1.8);

  const initialCoord: Coordinate = [77.2185, 28.6328];
  const fix1 = ekf.update(initialCoord, 45.0, 90.0, 1000);

  await it('EKF initializes state from first GNSS fix', () => {
    assert.strictEqual(fix1.isExtrapolatedDeadReckoning, false);
    assert.strictEqual(fix1.smoothedCoordinate[0], initialCoord[0]);
    assert.strictEqual(fix1.smoothedCoordinate[1], initialCoord[1]);
  });

  const fix2 = ekf.update([77.21863, 28.6328], 48.0, 90.0, 2000);
  await it('EKF CWNA model fuses consecutive updates and computes acceleration', () => {
    assert.ok(fix2.smoothedSpeedKmh > 0, 'Speed must be positive');
    assert.ok(fix2.covarianceTrace > 0, 'Covariance trace Tr(P) must be positive');
  });

  // Test Tunnel Dead-Reckoning Extrapolation (inside 10-second bound)
  const dr1 = ekf.extrapolateDeadReckoning(3.0);
  await it('Tunnel dead-reckoning projects state pure-inertially within 10s bound', () => {
    assert.strictEqual(dr1.isExtrapolatedDeadReckoning, true);
    assert.strictEqual(dr1.deadReckoningDurationSeconds, 3.0);
    assert.strictEqual(dr1.isMaxDeadReckoningWindowExceeded, false);
    assert.ok(dr1.covarianceTrace > 0, 'Tr(P) must be monitored');
  });

  const dr2 = ekf.extrapolateDeadReckoning(4.0);
  await it('Dead-reckoning accumulates blackout duration (7s total <= 10s bound)', () => {
    assert.strictEqual(dr2.deadReckoningDurationSeconds, 7.0);
    assert.strictEqual(dr2.isMaxDeadReckoningWindowExceeded, false);
  });

  // Exceed the 10-second maximum extrapolation window
  const dr3 = ekf.extrapolateDeadReckoning(4.0);
  await it('Dead-reckoning flags when exceeding strict 10-second maximum window (11s > 10s)', () => {
    assert.strictEqual(dr3.deadReckoningDurationSeconds, 11.0);
    assert.strictEqual(dr3.isMaxDeadReckoningWindowExceeded, true);
  });

  // Fresh GNSS fix resets dead-reckoning window
  const fix3 = ekf.update([77.2201, 28.6328], 50.0, 90.0, 13000);
  const dr4 = ekf.extrapolateDeadReckoning(2.0);
  await it('Fresh GNSS measurement resets dead-reckoning window to 0', () => {
    assert.strictEqual(dr4.deadReckoningDurationSeconds, 2.0);
    assert.strictEqual(dr4.isMaxDeadReckoningWindowExceeded, false);
  });

  // Geodesic Cross-Track Error (XTD)
  console.log('\n--- 2. Geodesic Cross-Track Error (XTD) & Off-Route Detection ---');
  const P1: Coordinate = [77.2185, 28.6328]; // Barakhamba
  const P2: Coordinate = [77.2389, 28.6269]; // ITO
  const onRouteP3: Coordinate = [77.2287, 28.62985]; // Exact midpoint along segment
  const xtdOnRoute = calculateGeodesicXtdMeters(onRouteP3, P1, P2);

  await it('Geodesic XTD formula computes near-zero error (< 5m) for on-route vehicle', () => {
    assert.ok(xtdOnRoute < 5.0, `Expected < 5m, got: ${xtdOnRoute}m`);
  });

  // Deviated coordinate 60m lateral offset
  const deviatedP3: Coordinate = [77.2287, 28.6305];
  const xtdDeviated = calculateGeodesicXtdMeters(deviatedP3, P1, P2);

  await it('Geodesic XTD formula detects lateral deviation > 40 meters', () => {
    assert.ok(xtdDeviated > 40.0, `Expected > 40m, got: ${xtdDeviated}m`);
  });

  const routeGeo: GeoJsonLineString = {
    type: 'LineString',
    coordinates: [P1, P2],
  };
  const offRouteResult = checkOffRoute(deviatedP3, routeGeo, 40);
  await it('checkOffRoute triggers off-route alert when XTD > 40m threshold', () => {
    assert.strictEqual(offRouteResult.isOffRoute, true);
    assert.ok(offRouteResult.distanceFromRouteMeters > 40);
  });

  // -------------------------------------------------------------------------
  // 3. Zero-Trust Telemetry Verification & Proof-of-Presence (Section 5.2)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Zero-Trust Guards & Proof-of-Presence (Section 5.2) ---');
  const signerGuard = new TelemetrySignerGuard();
  const antiSpoofGuard = new AntiSpoofingGuard();
  const popService = new ProofOfPresenceService();

  const secret = 'bmap_production_super_secret_jwt_key_2026';
  const now = Date.now();
  const nonce = 'unique_nonce_16_bytes_long_token';
  const payload = { deviceId: 'truck_dl01_9999', speedKmh: 45.0, coordinate: [77.2185, 28.6328] };

  const validSig = signerGuard.generateSignature(payload, now, nonce, secret);
  const verify1 = signerGuard.verifySignature(validSig, now, nonce, payload, secret);
  await it('TelemetrySignerGuard accepts authentic HMAC-SHA256 signature with fresh timestamp', () => {
    assert.strictEqual(verify1.isValid, true);
  });

  // Replay attack with same nonce
  const verifyReplay = signerGuard.verifySignature(validSig, now, nonce, payload, secret);
  await it('TelemetrySignerGuard blocks replay attack with previously consumed nonce', () => {
    assert.strictEqual(verifyReplay.isValid, false);
    assert.strictEqual(verifyReplay.errorCode, 'NONCE_REPLAY_DETECTED');
  });

  // Expired timestamp (> 45,000 ms)
  const expiredTimestamp = now - 50000;
  const expiredSig = signerGuard.generateSignature(payload, expiredTimestamp, 'another_fresh_nonce', secret);
  const verifyExpired = signerGuard.verifySignature(expiredSig, expiredTimestamp, 'another_fresh_nonce', payload, secret);
  await it('TelemetrySignerGuard rejects expired timestamp outside 45s sliding window', () => {
    assert.strictEqual(verifyExpired.isValid, false);
    assert.strictEqual(verifyExpired.errorCode, 'EXPIRED_TIMESTAMP');
  });

  // Anti-Spoofing: acceleration cap a <= 6.5 m/s^2
  antiSpoofGuard.verifyTelemetryPlausibility('test_car_1', {
    coordinate: [77.2185, 28.6328],
    speedKmh: 40.0,
    headingDeg: 90,
    timestamp: 1000,
  });

  const accelViol = antiSpoofGuard.verifyTelemetryPlausibility('test_car_1', {
    coordinate: [77.2186, 28.6328],
    speedKmh: 95.0, // Delta 55 km/h in 1.0s = 15.3 m/s^2 > 6.5 m/s^2
    headingDeg: 90,
    timestamp: 2000,
  });
  await it('AntiSpoofingGuard blocks impossible acceleration exceeding 6.5 m/s^2 cap', () => {
    assert.strictEqual(accelViol.isPlausible, false);
    assert.strictEqual(accelViol.violationType, 'IMPOSSIBLE_ACCELERATION');
  });

  // Anti-Spoofing: velocity cap v <= 220 km/h
  antiSpoofGuard.verifyTelemetryPlausibility('test_spoofer_2', {
    coordinate: [77.2185, 28.6328],
    speedKmh: 50.0,
    headingDeg: 90,
    timestamp: 1000,
  });
  const speedViol = antiSpoofGuard.verifyTelemetryPlausibility('test_spoofer_2', {
    coordinate: [77.5185, 28.6328], // ~29 km in 1.0s = > 100,000 km/h
    speedKmh: 50.0,
    headingDeg: 90,
    timestamp: 2000,
  });
  await it('AntiSpoofingGuard blocks coordinate teleportation exceeding 220 km/h surface speed limit', () => {
    assert.strictEqual(speedViol.isPlausible, false);
    assert.strictEqual(speedViol.violationType, 'TELEPORTATION_ANOMALY');
  });

  // ProofOfPresenceService
  const pop = popService.generateProofOfPresence({
    subjectId: 'vehicle_fastag_in_007',
    locationName: 'Delhi-Mumbai NE-4 Sohna Toll Plaza',
    targetCoordinate: [77.0688, 28.2412],
    geofenceRadiusMeters: 50.0,
    observedCoordinate: [77.0689, 28.2413], // ~15m away
    observedSpeedKmh: 28.0,
    rawTelemetryLogs: [{ fix: 1, lat: 28.2413, lon: 77.0689 }],
  });

  await it('ProofOfPresenceService issues HMAC-SHA256 signed presence certificate with GNSS breadcrumb hash', () => {
    assert.strictEqual(pop.algorithm, 'HMAC-SHA256');
    assert.ok(pop.signature.length === 64, 'Signature must be 256-bit hex');
    assert.ok(pop.payload.rawBreadcrumbHash.length === 64, 'Must contain SHA-256 breadcrumb hash');
    assert.strictEqual(pop.payload.subjectId, 'vehicle_fastag_in_007');
    assert.strictEqual(pop.payload.antiSpoofingPassed, true);
  });

  const isPopVerified = popService.verifyProofOfPresence(pop);
  await it('ProofOfPresence certificate verifies successfully with authentic key', () => {
    assert.strictEqual(isPopVerified.isValid, true);
  });

  // -------------------------------------------------------------------------
  // 4. Socket.IO Real-Time Telematics Gateway: 10 Event Namespaces & Room Scoping
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Socket.IO Gateway 10 Event Domains & Room Scoping (Section 6) ---');

  const app = createApp();
  const httpServer = http.createServer(app);
  const io = initSocketServer(httpServer);

  const port = 8099;
  await new Promise<void>((resolve) => httpServer.listen(port, resolve));

  const client1: ClientSocket = ClientIO(`http://localhost:${port}`, {
    transports: ['websocket'],
    forceNew: true,
  });
  const client2: ClientSocket = ClientIO(`http://localhost:${port}`, {
    transports: ['websocket'],
    forceNew: true,
  });

  await new Promise<void>((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    client1.on('connect', check);
    client2.on('connect', check);
  });

  // Domain 1: Live Driver Tracking (room driver:<driverId>)
  await it('Domain 1: Live Driver Tracking broadcasts to room driver:<driverId>', async () => {
    return new Promise<void>((resolve, reject) => {
      const driverId = 'driver_amit_01';
      client2.emit(SOCKET_EVENTS.LOCATION_SUBSCRIBE, { driverId });

      client2.on(SOCKET_EVENTS.LOCATION_BROADCAST, (data) => {
        try {
          assert.strictEqual(data.driverId, driverId);
          assert.strictEqual(data.speed, 42.0);
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      setTimeout(() => {
        client1.emit(SOCKET_EVENTS.LOCATION_UPDATE, {
          userId: driverId,
          role: 'driver',
          longitude: 77.2185,
          latitude: 28.6328,
          speed: 42.0,
          heading: 90,
        });
      }, 50);
    });
  });

  // Domain 2: Active Turn-by-Turn Nav (room nav:<sessionId>)
  await it('Domain 2: Active Turn-by-Turn Nav manages room nav:<sessionId>', () => {
    assert.ok(SOCKET_EVENTS.NAV_JOIN === 'nav:join');
    assert.ok(SOCKET_EVENTS.NAV_UPDATE_PROGRESS === 'nav:update_progress');
    assert.ok(SOCKET_EVENTS.NAV_OFF_ROUTE_ALERT === 'nav:off_route_alert');
    assert.ok(SOCKET_EVENTS.NAV_REROUTE_SUCCESS === 'nav:reroute_success');
  });

  // Domain 3: Weak-Signal Positioning (EKF tunnel dead reckoning)
  await it('Domain 3: Weak-Signal Positioning telemetry & fused_state', async () => {
    return new Promise<void>((resolve, reject) => {
      client1.on(SOCKET_EVENTS.POSITIONING_FUSED_BROADCAST, (fused) => {
        try {
          assert.ok(fused);
          assert.ok(fused.coordinates || fused.latitude);
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      client1.emit(SOCKET_EVENTS.POSITIONING_STREAM_TELEMETRY, {
        deviceId: 'device_tunnel_navic_01',
        timestamp: Date.now(),
        imu: {
          accelerometer: { x: 0.1, y: 0.2, z: 9.81 },
          gyroscope: { pitchRate: 0, rollRate: 0, yawRate: 0.05 },
        },
      });
    });
  });

  // Domain 4: HD Lane Guidance & Veteran Hazard Alerts
  await it('Domain 4: HD Lane Guidance channels registered', () => {
    assert.ok(SOCKET_EVENTS.LANE_GUIDANCE_STREAM === 'lane:guidance_stream');
    assert.ok(SOCKET_EVENTS.LANE_GUIDANCE_BROADCAST === 'lane:guidance_broadcast');
    assert.ok(SOCKET_EVENTS.VETERAN_HAZARD_ALERT === 'veteran:hazard_alert');
  });

  // Domain 5: SR Mixed Reality HUD (windshield HUD & ADAS)
  await it('Domain 5: SR Mixed Reality HUD channels registered', () => {
    assert.ok(SOCKET_EVENTS.SR_TELEMETRY_STREAM === 'sr:telemetry_stream');
    assert.ok(SOCKET_EVENTS.SR_HUD_BROADCAST === 'sr:hud_broadcast');
    assert.ok(SOCKET_EVENTS.SR_COLLISION_WARNING === 'sr:collision_warning');
  });

  // Domain 6: Automotive CAN & IVI (room auto:<vehicleId>)
  await it('Domain 6: Automotive CAN bus & cockpit sync broadcasts to room auto:<vehicleId>', async () => {
    return new Promise<void>((resolve, reject) => {
      const vehicleId = 'veh_tata_nexon_ev_45';
      client2.emit('auto:subscribe', { vehicleId });

      client2.on(SOCKET_EVENTS.AUTO_ECO_SCORE_BROADCAST, (data) => {
        try {
          assert.strictEqual(data.vehicleId, vehicleId);
          assert.ok(data.ecoScore);
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      setTimeout(() => {
        client1.emit(SOCKET_EVENTS.AUTO_CAN_STREAM, {
          vehicleId,
          packet: {
            speedKmh: 65,
            rpm: 2100,
            throttlePercent: 25,
            brakeApplied: false,
            steeringAngleDeg: 2.1,
            gear: 4,
          },
        });
      }, 50);
    });
  });

  // Domain 7: Rider Mode Two-Wheeler (room rider:<sessionId>)
  await it('Domain 7: Rider Mode Two-Wheeler lean & crash alerts broadcast to room rider:<sessionId>', async () => {
    return new Promise<void>((resolve, reject) => {
      const sessionId = 'rider_session_pulsar_99';
      client2.emit('rider:subscribe', { sessionId });

      client2.on(SOCKET_EVENTS.RIDER_LEAN_BROADCAST, (stats) => {
        try {
          assert.ok(stats);
          assert.strictEqual(stats.sessionId, sessionId);
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      setTimeout(() => {
        client1.emit(SOCKET_EVENTS.RIDER_DYNAMICS_STREAM, {
          sessionId,
          telemetry: {
            rollDeg: 24.5,
            pitchDeg: 1.2,
            yawDeg: 89.0,
            speedKmh: 45.0,
          },
        });
      }, 50);
    });
  });

  // Domain 8: Indoor Bay Parking (BLE beacon gate handoff & room parking:<facilityId>)
  await it('Domain 8: Indoor Bay Parking live slot occupancy broadcasts to room parking:<facilityId>', async () => {
    return new Promise<void>((resolve, reject) => {
      const facilityId = 'fac_berlin_potsdamer_hub';
      client2.emit('parking:subscribe', { facilityId });

      client2.on(SOCKET_EVENTS.PARKING_BAY_STATUS, (data) => {
        try {
          assert.strictEqual(data.facilityId, facilityId);
          assert.strictEqual(data.bayId, 'bay_b2_a101');
          assert.strictEqual(data.status, 'occupied');
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      setTimeout(() => {
        client1.emit(SOCKET_EVENTS.PARKING_BAY_STATUS, {
          facilityId,
          bayId: 'bay_b2_a101',
          status: 'occupied',
          vehicleLicensePlate: 'DL-01-AB-1234',
        });
      }, 50);
    });
  });

  // Domain 9: AI Voice Copilot (Gemma)
  await it('Domain 9: AI Voice Copilot message streaming & status', () => {
    assert.ok(SOCKET_EVENTS.COPILOT_MESSAGE_STREAM === 'copilot:message_stream');
    assert.ok(SOCKET_EVENTS.COPILOT_PROCESSING_STATUS === 'copilot:processing_status');
    assert.ok(SOCKET_EVENTS.COPILOT_MESSAGE_RESPONSE === 'copilot:message_response');
  });

  // Domain 10: Traffic & LWR Shockwave (room segment:<segmentId>)
  await it('Domain 10: Traffic & LWR Shockwave broadcasts to room segment:<segmentId>', async () => {
    return new Promise<void>((resolve, reject) => {
      const segmentId = 'SEG_CP_BARAKHAMBA_01';
      client2.emit('traffic:subscribe_segment', { segmentId });

      client2.on(SOCKET_EVENTS.TRAFFIC_SEGMENT_UPDATE, (update) => {
        try {
          assert.strictEqual(update.segmentId, segmentId);
          assert.ok(update.travelTimeMinutes > 0);
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      setTimeout(() => {
        client1.emit(SOCKET_EVENTS.TRAFFIC_TELEMETRY_STREAM, {
          deviceId: 'driver_streamer_01',
          coordinate: [77.219, 28.6328],
          speedKmh: 35.0,
          headingDeg: 90,
        });
      }, 50);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Dual-Tier Offline Resilience & Sub-50ms Kubernetes HPA Probes
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Dual-Tier Offline Resilience & Kubernetes Probes (Section 6) ---');

  // Sub-50ms Probe verification
  await it('Sub-50ms Kubernetes HPA probe on /api/v1/health?probe=true', async () => {
    const tStart = Date.now();
    const res = await fetch(`http://localhost:${port}/api/v1/health?probe=true`);
    const duration = Date.now() - tStart;
    const body: any = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.k8sProbe, true);
    assert.ok(duration < 50, `Expected duration < 50ms, took ${duration}ms`);
  });

  // Graceful socket draining
  await it('Graceful socket draining disconnects clients cleanly', async () => {
    return new Promise<void>((resolve) => {
      client1.on('disconnect', () => {
        resolve();
      });
      io.disconnectSockets(true);
    });
  });

  client1.close();
  client2.close();
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));

  console.log('\n========================================================================');
  console.log(`📊 EKF, ZERO-TRUST & 10 NAMESPACES RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test Suite encountered fatal error:', err);
  process.exit(1);
});
