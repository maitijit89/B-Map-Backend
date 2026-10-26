import { ExtendedKalmanFilter } from '../src/core/algorithms/extended-kalman-filter';
import { antiSpoofingGuard } from '../src/core/security/anti-spoofing.guard';
import { telemetrySignerGuard } from '../src/core/security/telemetry-signer.guard';
import { proofOfPresenceService } from '../src/core/security/proof-of-presence';
import { trafficShockwaveService } from '../src/modules/traffic/traffic-shockwave.service';
import { ecoRoutingService } from '../src/modules/traffic/eco-routing.service';
import { trafficGraphService } from '../src/modules/traffic/traffic-graph.service';

async function runSmartAndSecureVerification() {
  console.log('========================================================================');
  console.log('🔬 ADVANCED RESEARCH ALGORITHMS & ZERO-TRUST SECURITY VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // 1. EXTENDED KALMAN FILTER (EKF) KINEMATIC TRAJECTORY & DEAD-RECKONING
  // --------------------------------------------------------------------------
  console.log('--- 1. Extended Kalman Filter (EKF) Kinematic Motion Fusion ---');
  const ekf = new ExtendedKalmanFilter(1.5);
  const now = Date.now();

  // Feed 4 consecutive noisy GPS measurements along an eastward driving trajectory
  const rawMeasurements = [
    { coord: [77.2185, 28.6328] as [number, number], speedKmh: 42.0, headingDeg: 90, t: now },
    { coord: [77.2187, 28.63281] as [number, number], speedKmh: 44.5, headingDeg: 91, t: now + 1000 },
    { coord: [77.2189, 28.63279] as [number, number], speedKmh: 46.0, headingDeg: 89, t: now + 2000 },
    { coord: [77.2191, 28.63282] as [number, number], speedKmh: 48.0, headingDeg: 90, t: now + 3000 },
  ];

  let lastEkfOutput: any;
  for (const m of rawMeasurements) {
    lastEkfOutput = ekf.update(m.coord, m.speedKmh, m.headingDeg, m.t, 4.0);
  }

  console.log('EKF Smoothed Output:', {
    smoothedCoord: lastEkfOutput.smoothedCoordinate,
    speedKmh: lastEkfOutput.smoothedSpeedKmh,
    headingDeg: lastEkfOutput.smoothedHeadingDeg,
    acceleration: lastEkfOutput.estimatedAccelerationMps2,
  });

  assert(lastEkfOutput.smoothedSpeedKmh > 35 && lastEkfOutput.smoothedSpeedKmh < 60, 'EKF must filter speed within kinematic bounds');
  assert(lastEkfOutput.estimatedAccelerationMps2 >= 0, 'EKF must compute valid positive kinematic acceleration');
  assert(lastEkfOutput.smoothedHeadingDeg >= 85 && lastEkfOutput.smoothedHeadingDeg <= 95, 'EKF must smooth heading orientation');

  // Test Tunnel Dead-Reckoning Extrapolation (simulated 2 seconds of zero GPS)
  const deadReckoning = ekf.extrapolateDeadReckoning(2.0);
  console.log('Tunnel Dead-Reckoning Extrapolation:', {
    extrapolatedCoord: deadReckoning.smoothedCoordinate,
    isExtrapolated: deadReckoning.isExtrapolatedDeadReckoning,
  });

  assert(deadReckoning.isExtrapolatedDeadReckoning === true, 'Dead-reckoning must be flagged as extrapolated');
  assert(deadReckoning.smoothedCoordinate[0] > lastEkfOutput.smoothedCoordinate[0], 'Dead-reckoning must advance coordinates forward along velocity vector');

  // --------------------------------------------------------------------------
  // 2. LIGHTHILL-WHITHAM-RICHARDS (LWR) MACROSCOPIC SHOCKWAVE PROPAGATION
  // --------------------------------------------------------------------------
  console.log('\n--- 2. LWR Traffic Flow Shockwave & Queue Spillback Prediction ---');
  const congestedEdge = trafficGraphService.getEdge('SEG_BARAKHAMBA_ITO_02')!;
  const upstreamEdge = trafficGraphService.getEdge('SEG_CP_BARAKHAMBA_01')!;

  // Simulate heavy downstream bottleneck
  congestedEdge.congestionLevel = 'congested';
  congestedEdge.effectiveSpeedKmh = 12.0;
  upstreamEdge.effectiveSpeedKmh = 45.0;

  const shockwaveResult = trafficShockwaveService.analyzeSegmentShockwave(congestedEdge, upstreamEdge, 3);
  console.log('LWR Shockwave Analysis:', {
    direction: shockwaveResult.direction,
    shockwaveVelocityKmh: shockwaveResult.shockwaveVelocityKmh,
    spillbackTimeToUpstreamMinutes: shockwaveResult.spillbackTimeToUpstreamMinutes,
    queueLengthMeters: shockwaveResult.queueLengthMeters,
  });

  assert(shockwaveResult.direction === 'BACKWARD_FORMING', 'Shockwave must be backward-forming (propagating upstream)');
  assert(shockwaveResult.shockwaveVelocityKmh < 0, 'Backward shockwave velocity must be negative (w < 0)');
  assert(
    typeof shockwaveResult.spillbackTimeToUpstreamMinutes === 'number' && shockwaveResult.spillbackTimeToUpstreamMinutes > 0,
    `Spillback time must be positive minutes (Got: ${shockwaveResult.spillbackTimeToUpstreamMinutes} mins)`
  );

  // --------------------------------------------------------------------------
  // 3. MULTI-CRITERIA PHYSICS-BASED ECO & ENERGY-OPTIMIZED ROUTING
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Multi-Criteria Eco & Energy-Consumption Evaluation ---');
  const corridorEdges = [
    trafficGraphService.getEdge('SEG_DHAULA_CYBER_05')!,
    trafficGraphService.getEdge('SEG_CYBER_IFFCO_06')!,
  ];

  const petrolEco = ecoRoutingService.evaluateRouteEco(corridorEdges, {
    propulsion: 'ice_petrol',
    curbMassKg: 1450,
    aerodynamicDragCoefficientCd: 0.3,
    frontalAreaM2: 2.2,
    rollingResistanceCoefficientCrr: 0.012,
    powertrainEfficiency: 0.28,
  });

  const evEco = ecoRoutingService.evaluateRouteEco(corridorEdges, {
    propulsion: 'ev_battery',
    curbMassKg: 1750,
    aerodynamicDragCoefficientCd: 0.24,
    frontalAreaM2: 2.1,
    rollingResistanceCoefficientCrr: 0.01,
    powertrainEfficiency: 0.88,
  });

  console.log('Eco Route Comparison:', {
    petrolFuelLiters: petrolEco.totalFuelLitersOrKwh,
    petrolCo2Kg: petrolEco.totalCo2Kg,
    evEnergyKwh: evEco.totalFuelLitersOrKwh,
    evCo2Kg: evEco.totalCo2Kg,
  });

  assert(petrolEco.totalFuelLitersOrKwh > 0, 'Petrol consumption must be calculated in liters');
  assert(evEco.totalFuelLitersOrKwh > 0, 'EV consumption must be calculated in kWh');
  assert(evEco.totalCo2Kg < petrolEco.totalCo2Kg, 'EV powertrain must demonstrate significant CO2 reduction vs ICE');

  // --------------------------------------------------------------------------
  // 4. ANTI-GPS SPOOFING & KINEMATIC PLAUSIBILITY DEFENSE
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Anti-GPS Spoofing & Kinematic Plausibility Guard ---');
  const spoofDevice = 'attacker_device_bot_666';

  // Fix 1: Normal baseline at Connaught Place
  antiSpoofingGuard.verifyTelemetryPlausibility(spoofDevice, {
    coordinate: [77.2185, 28.6328],
    speedKmh: 30.0,
    headingDeg: 90,
    timestamp: now,
  });

  // Attack A: Teleportation jump (e.g. 50 km away in 2 seconds)
  const teleportAssessment = antiSpoofingGuard.verifyTelemetryPlausibility(spoofDevice, {
    coordinate: [77.6585, 28.9928], // ~55 km away
    speedKmh: 40.0,
    headingDeg: 90,
    timestamp: now + 2000,
  });

  console.log('Teleport Attack Assessment:', teleportAssessment.explanation);
  assert(teleportAssessment.isPlausible === false, 'Teleportation attack must be flagged as implausible');
  assert(teleportAssessment.threatLevel === 'CRITICAL_SPOOFING', 'Threat level must be CRITICAL_SPOOFING');
  assert(teleportAssessment.violationType === 'TELEPORTATION_ANOMALY', 'Violation must be TELEPORTATION_ANOMALY');

  // Attack B: Impossible acceleration (e.g. speed jump from 20 km/h to 180 km/h in 1 second = 44.4 m/s^2)
  const accelDevice = 'drag_spoofer_99';
  antiSpoofingGuard.verifyTelemetryPlausibility(accelDevice, {
    coordinate: [77.2185, 28.6328],
    speedKmh: 20.0,
    headingDeg: 90,
    timestamp: now,
  });
  const accelAssessment = antiSpoofingGuard.verifyTelemetryPlausibility(accelDevice, {
    coordinate: [77.2187, 28.6328], // ~19.5m away in 1s = 70.2 km/h (within surface speed, but reported acceleration is 44.4 m/s^2)
    speedKmh: 180.0,
    headingDeg: 90,
    timestamp: now + 1000,
  });

  console.log('Impossible Acceleration Assessment:', accelAssessment.explanation);
  assert(accelAssessment.isPlausible === false, 'Impossible acceleration must be blocked');
  assert(accelAssessment.violationType === 'IMPOSSIBLE_ACCELERATION', 'Violation must be IMPOSSIBLE_ACCELERATION');

  // --------------------------------------------------------------------------
  // 5. ZERO-TRUST TELEMETRY SIGNING & ANTI-REPLAY GUARD
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Zero-Trust Cryptographic Telemetry Signing & Anti-Replay ---');
  const telemetryPayload = { deviceId: 'driver_fleet_42', speed: 48.5, lat: 28.6328, lon: 77.2185 };
  const nonce = 'unique_nonce_abc123xyz789';
  const validTimestamp = Date.now();

  const signature = telemetrySignerGuard.generateSignature(telemetryPayload, validTimestamp, nonce);

  // Verification 1: Valid signature and fresh nonce
  const validAuth = telemetrySignerGuard.verifySignature(
    signature,
    validTimestamp,
    nonce,
    telemetryPayload
  );
  assert(validAuth.isValid === true, 'Valid cryptographic signature must be accepted');

  // Verification 2: Replay attack (reusing the same nonce)
  const replayAuth = telemetrySignerGuard.verifySignature(
    signature,
    validTimestamp,
    nonce, // Reused nonce!
    telemetryPayload
  );
  assert(replayAuth.isValid === false, 'Replaying a previously consumed nonce must be blocked');
  assert(replayAuth.errorCode === 'NONCE_REPLAY_DETECTED', 'Must trigger NONCE_REPLAY_DETECTED');

  // Verification 3: Expired timestamp (older than 45-second sliding window)
  const expiredTimestamp = Date.now() - 60000; // 60 seconds ago
  const expiredSig = telemetrySignerGuard.generateSignature(telemetryPayload, expiredTimestamp, 'nonce_expired_1');
  const expiredAuth = telemetrySignerGuard.verifySignature(
    expiredSig,
    expiredTimestamp,
    'nonce_expired_1',
    telemetryPayload
  );
  assert(expiredAuth.isValid === false, 'Expired telemetry request must be rejected');
  assert(expiredAuth.errorCode === 'EXPIRED_TIMESTAMP', 'Must trigger EXPIRED_TIMESTAMP');

  // --------------------------------------------------------------------------
  // 6. CRYPTOGRAPHIC PROOF-OF-PRESENCE & GEOFENCE ATTESTATION
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Cryptographic Spatial Proof-of-Presence Attestation ---');
  const presenceAttestation = proofOfPresenceService.generateProofOfPresence({
    subjectId: 'vehicle_dl_01_ab_1234',
    locationName: 'Delhi-Gurugram Expressway NE-4 Toll Plaza',
    targetCoordinate: [77.0885, 28.4955],
    geofenceRadiusMeters: 50.0,
    observedCoordinate: [77.0886, 28.4956], // ~14m away (inside 50m geofence)
    observedSpeedKmh: 18.5,
    accuracyMeters: 3.5,
  });

  console.log('Generated Proof-of-Presence Certificate:', {
    attestationId: presenceAttestation.attestationId,
    location: presenceAttestation.payload.locationName,
    distanceMeters: presenceAttestation.payload.distanceFromCentroidMeters,
    confidenceScore: presenceAttestation.payload.confidenceScore,
  });

  assert(presenceAttestation.signature.length === 64, 'Attestation signature must be 256-bit hex HMAC');
  assert(presenceAttestation.payload.confidenceScore > 0.8, 'Confidence score must be high for sub-15m fix');

  // Validate authentic certificate
  const verifyValid = proofOfPresenceService.verifyProofOfPresence(presenceAttestation);
  assert(verifyValid.isValid === true, 'Authentic Proof-of-Presence certificate must pass verification');

  // Validate tampered certificate
  const tamperedAttestation = JSON.parse(JSON.stringify(presenceAttestation));
  tamperedAttestation.payload.locationName = 'Tampered Non-Existent Toll Plaza';
  const verifyTampered = proofOfPresenceService.verifyProofOfPresence(tamperedAttestation);
  assert(verifyTampered.isValid === false, 'Tampered Proof-of-Presence certificate must be rejected');

  console.log('\n========================================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSmartAndSecureVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
