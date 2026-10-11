import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/core/config/env.config';
import { sessionValidationService } from '../src/modules/location-access/session-validation.service';

async function runLocationAccessTest() {
  console.log('================================================================');
  console.log('📍 B-MAP FOREGROUND/BACKGROUND LOCATION ACCESS & INGESTION TEST');
  console.log('================================================================\n');

  const app = createApp();
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}${detail ? ` -> ${detail}` : ''}`);
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    }
  }

  const testUserId = `driver_${Date.now()}`;
  const validTripId = `trip_nav_${Date.now()}`;
  const nonExistentTripId = `fake_trip_999999`;

  // --- PILLAR 1: SESSION VALIDATION & PRIVACY GUARD ---
  console.log('--- 1. Session Validation & Privacy Guard ---');

  // Case 1A: Transmitting coordinates with NO active trip session
  const roguePayload = {
    tripId: nonExistentTripId,
    userId: testUserId,
    coordinates: [13.404954, 52.520008],
    appLifecycleMode: 'foreground',
    heading: 90,
    speed: 35.5,
  };

  const rogueRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send(roguePayload);

  assert(
    rogueRes.status === 403,
    'Rejects coordinates when no active trip session exists (HTTP 403 Forbidden)',
    `Status: ${rogueRes.status}`
  );
  assert(
    rogueRes.body.errorCode === 'PRIVACY_REJECTION_NO_ACTIVE_TRIP',
    'Returns PRIVACY_REJECTION_NO_ACTIVE_TRIP error code',
    rogueRes.body.errorCode
  );
  assert(
    rogueRes.body.message.includes('protect user privacy'),
    'Protects user privacy by refusing telemetry without active trip',
    rogueRes.body.message
  );

  // Case 1B: Activate a legitimate trip session
  console.log('\n--- 2. Active Trip Registration ---');
  await sessionValidationService.registerActiveTrip(
    validTripId,
    testUserId,
    [13.4114, 52.5218] // Destination coordinates: Alexanderplatz
  );
  console.log(`🗺️ Registered active trip session "${validTripId}" for user "${testUserId}".`);

  // --- PILLAR 2: FOREGROUND HIGH-FREQUENCY INGESTION (1–2 SECONDS) ---
  console.log('\n--- 3. Foreground High-Frequency Updates (1–2s Interval) ---');
  const fgFix1 = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: validTripId,
      userId: testUserId,
      coordinates: [13.38886, 52.517037],
      heading: 45,
      speed: 40.0,
      accuracy: 4.5,
      appLifecycleMode: 'foreground',
      permissions: {
        fineLocation: true, // ACCESS_FINE_LOCATION
        backgroundLocation: true, // ACCESS_BACKGROUND_LOCATION
        permissionLevel: 'granted_always',
      },
      batteryLevel: 0.85,
    });

  assert(fgFix1.status === 200, 'Accepts foreground location fix for active trip with 200 OK');
  assert(fgFix1.body.data.accepted === true, 'Telemetry accepted');
  assert(
    fgFix1.body.data.ingestionRate.mode === 'high_frequency',
    'Ingestion mode set to "high_frequency"',
    fgFix1.body.data.ingestionRate.mode
  );
  assert(
    fgFix1.body.data.ingestionRate.recommendedIntervalSeconds <= 2,
    'Target reporting interval set to 1–2 seconds for turn-by-turn guidance',
    `${fgFix1.body.data.ingestionRate.recommendedIntervalSeconds}s`
  );
  assert(
    fgFix1.body.data.ingestionRate.batterySavingActive === false,
    'Battery saving inactive during active foreground navigation'
  );

  // Fast forward 1.5 seconds - second foreground update
  const fgFix2 = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: validTripId,
      userId: testUserId,
      coordinates: [13.3892, 52.5172],
      heading: 48,
      speed: 42.0,
      accuracy: 3.8,
      appLifecycleMode: 'foreground',
      timestamp: Date.now() + 1500,
    });

  assert(fgFix2.status === 200, 'Seamlessly ingests rapid 1.5s interval foreground updates without throttling');

  // --- PILLAR 3: BACKGROUND LOW-FREQUENCY INGESTION (30–60 SECONDS) ---
  console.log('\n--- 4. Background Transition & Battery Saving Regulation (30–60s) ---');

  // Client notifies lifecycle transition to background
  const lifecycleRes = await request(app)
    .post(`${env.API_PREFIX}/location/lifecycle-mode`)
    .send({
      tripId: validTripId,
      userId: testUserId,
      appLifecycleMode: 'background',
      permissions: {
        fineLocation: true,
        backgroundLocation: true,
      },
      batteryLevel: 0.72,
    });

  assert(lifecycleRes.status === 200, 'Client successfully reports transition to background');
  assert(
    lifecycleRes.body.data.policy.recommendedIntervalSeconds >= 30,
    'Server instructs client OS to throttle background pings to 30–60s to save battery',
    `${lifecycleRes.body.data.policy.recommendedIntervalSeconds}s`
  );
  assert(
    lifecycleRes.body.data.policy.batterySavingActive === true,
    'Battery saving mode marked ACTIVE for background state'
  );

  // Client transmits background ping
  const bgFix1 = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: validTripId,
      userId: testUserId,
      coordinates: [13.395, 52.518],
      heading: 90,
      speed: 35.0,
      appLifecycleMode: 'background',
      timestamp: Date.now() + 32000, // 32 seconds later
    });

  assert(bgFix1.status === 200, 'Accepts valid 30s background ping with 200 OK');
  assert(
    bgFix1.body.data.ingestionRate.mode === 'low_frequency',
    'Ingestion mode switched to "low_frequency" for battery conservation',
    bgFix1.body.data.ingestionRate.mode
  );
  assert(
    bgFix1.body.data.ingestionRate.throttleApplied === false,
    'Legitimate 30s background transmission is not throttled'
  );

  // --- PILLAR 4: STATIONARY DETECTION IN BACKGROUND (60S INTERVAL) ---
  console.log('\n--- 5. Stationary Detection in Background (Backed off to 60s) ---');
  // Stopped at red light / parked (speed = 0.5 km/h, movement = 2m)
  const stationaryFix = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: validTripId,
      userId: testUserId,
      coordinates: [13.39502, 52.51801], // negligible change
      heading: 90,
      speed: 0.5,
      appLifecycleMode: 'background',
      timestamp: Date.now() + 65000, // 33 seconds after previous
    });

  assert(stationaryFix.status === 200, 'Accepts stationary background update');
  assert(
    stationaryFix.body.data.ingestionRate.recommendedIntervalSeconds === 60,
    'Backs off background interval to 60 seconds when vehicle is stationary',
    `${stationaryFix.body.data.ingestionRate.recommendedIntervalSeconds}s`
  );

  // --- PILLAR 5: GEOFENCING MILESTONE TRIGGER OVERRIDE ---
  console.log('\n--- 6. Geofencing Milestone Trigger Bypass ---');
  // Client wakes up immediately when approaching destination geofence
  const geofenceWakeupFix = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: validTripId,
      userId: testUserId,
      coordinates: [13.410, 52.5215], // Near destination (Alexanderplatz)
      heading: 85,
      speed: 25.0,
      appLifecycleMode: 'background',
      isGeofenceTrigger: true, // Triggered by OS Geofence Event
      geofenceEvent: {
        milestoneId: 'ms_dest_500m',
        type: 'APPROACHING_DESTINATION',
        distanceToTargetMeters: 140,
      },
      timestamp: Date.now() + 68000, // Only 3 seconds after previous, but flagged as geofence trigger!
    });

  assert(geofenceWakeupFix.status === 200, 'Accepts immediate geofencing wakeup even in background mode');
  assert(
    geofenceWakeupFix.body.data.ingestionRate.throttleApplied === false,
    'Zero throttling applied to milestone geofence trigger'
  );
  assert(
    geofenceWakeupFix.body.data.geofencingContext?.isWithinMilestoneGeofence === true,
    'Detects user is within destination milestone geofence (<= 500m)'
  );

  // --- PILLAR 6: TRIP TERMINATION & PRIVACY LOCK ---
  console.log('\n--- 7. Trip Termination & Subsequent Privacy Rejection ---');
  // Terminate trip
  const terminateRes = await request(app)
    .post(`${env.API_PREFIX}/location/session/${validTripId}/terminate`)
    .send({ status: 'completed' });

  assert(terminateRes.status === 200, 'Trip terminated successfully');

  // Client attempts to transmit coordinates after trip ended
  const postTripFix = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: validTripId,
      userId: testUserId,
      coordinates: [13.4114, 52.5218],
      appLifecycleMode: 'background',
    });

  assert(
    postTripFix.status === 403,
    'Immediately rejects coordinates after trip is completed to protect user privacy (403)',
    `Status: ${postTripFix.status}`
  );
  assert(
    postTripFix.body.errorCode === 'PRIVACY_REJECTION_SESSION_TERMINATED',
    'Returns PRIVACY_REJECTION_SESSION_TERMINATED',
    postTripFix.body.errorCode
  );

  console.log('\n================================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 LOCATION ACCESS, DYNAMIC INGESTION & PRIVACY VALIDATION SUITE PASSED!');
    process.exit(0);
  } else {
    console.error('💥 Some location access tests failed.');
    process.exit(1);
  }
}

runLocationAccessTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
