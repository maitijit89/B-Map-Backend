import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/core/config/env.config';
import { sessionValidationService } from '../src/modules/location-access/session-validation.service';
import { activityRecognitionService } from '../src/modules/motion-fitness/activity-recognition.service';

async function runMotionFitnessTest() {
  console.log('====================================================================');
  console.log('🏃 B-MAP PHYSICAL ACTIVITY / MOTION & FITNESS RECOGNITION TEST SUITE');
  console.log('====================================================================\n');

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

  const testUserId = `driver_motion_${Date.now()}`;
  const testTripId = `trip_motion_${Date.now()}`;
  const destinationCoords: [number, number] = [13.4114, 52.5218]; // Alexanderplatz

  // Register active trip session for testing
  await sessionValidationService.registerActiveTrip(testTripId, testUserId, destinationCoords);
  console.log(`🗺️ Active trip "${testTripId}" registered with destination [13.4114, 52.5218].\n`);

  // --- PILLAR 1: PERMISSION AWARENESS & ACTIVITY INGESTION ---
  console.log('--- 1. Client Motion & Fitness Permission & Activity Ingestion ---');
  const drivingFix = await request(app)
    .post(`${env.API_PREFIX}/motion/activity`)
    .send({
      tripId: testTripId,
      userId: testUserId,
      activity: 'DRIVING',
      confidence: 96,
      coordinates: [13.38886, 52.517037],
      speed: 48.5,
      heading: 65,
      permissions: {
        activityRecognition: true, // Android ACTIVITY_RECOGNITION / iOS Motion & Fitness
        fineLocation: true,
      },
    });

  assert(drivingFix.status === 200, 'Accepts DRIVING motion telemetry fix with 200 OK');
  assert(drivingFix.body.data.currentActivity === 'DRIVING', 'Normalized activity confirmed as DRIVING');
  assert(drivingFix.body.data.isStill === false, 'Vehicle is in motion (isStill: false)');
  assert(drivingFix.body.data.confidence === 96, 'Confidence parsed correctly (96%)');

  // --- PILLAR 2: NORMAL STILL ACCUMULATION UNDER 5 MINUTES ---
  console.log('\n--- 2. Short Pause (Under 5 Minutes - No Auto-Pause Triggered) ---');
  const startTime = Date.now();

  const shortStillFix = await request(app)
    .post(`${env.API_PREFIX}/motion/activity`)
    .send({
      tripId: testTripId,
      userId: testUserId,
      activity: 'STILL',
      confidence: 98,
      coordinates: [13.38886, 52.517037],
      speed: 0.0,
      timestamp: startTime + 60000, // 1 minute later
    });

  assert(shortStillFix.status === 200, 'Ingests STILL activity state');
  assert(shortStillFix.body.data.isStill === true, 'Vehicle flagged as STILL');
  assert(shortStillFix.body.data.actionTriggered === 'NONE', 'No auto-pause triggered within normal 1-minute stop');
  assert(shortStillFix.body.data.tripStatus === 'active', 'Trip remains ACTIVE');

  // --- PILLAR 3: 5-MINUTE INACTIVITY ALGORITHMIC AUTO-PAUSE ---
  console.log('\n--- 3. Algorithmic State Switching: Auto-Pause (>5 Minutes Inactivity) ---');
  // Fast forward past the 5-minute threshold (305 seconds = 5m 5s)
  const fiveMinStillFix = await request(app)
    .post(`${env.API_PREFIX}/motion/activity`)
    .send({
      tripId: testTripId,
      userId: testUserId,
      activity: 'STILL',
      confidence: 100,
      coordinates: [13.38886, 52.517037], // 2.5 km away from destination
      speed: 0.0,
      timestamp: startTime + 365000, // > 5 minutes after stillness started at startTime + 60000
    });

  assert(fiveMinStillFix.status === 200, 'Processes 5-minute stationary state update');
  assert(
    fiveMinStillFix.body.data.actionTriggered === 'AUTO_PAUSE',
    'Algorithmically triggers AUTO_PAUSE state switch when stopped for >5 minutes',
    fiveMinStillFix.body.data.actionTriggered
  );
  assert(fiveMinStillFix.body.data.tripStatus === 'paused', 'Trip status automatically updated to "paused"');
  assert(
    fiveMinStillFix.body.data.automatedPing?.shouldNotifyClient === true,
    'Triggers automated notification ping to client device'
  );
  assert(
    fiveMinStillFix.body.data.automatedPing?.title === 'Trip Auto-Paused',
    'Notification title informs user of auto-pause',
    fiveMinStillFix.body.data.automatedPing?.title
  );

  // --- PILLAR 4: AUTOMATIC RESUME UPON MOTION DETECTION ---
  console.log('\n--- 4. Algorithmic State Switching: Auto-Resume Upon Movement ---');
  const resumedFix = await request(app)
    .post(`${env.API_PREFIX}/motion/activity`)
    .send({
      tripId: testTripId,
      userId: testUserId,
      activity: 'DRIVING',
      confidence: 94,
      coordinates: [13.392, 52.518],
      speed: 35.0,
      timestamp: startTime + 375000,
    });

  assert(resumedFix.status === 200, 'Processes motion update');
  assert(
    resumedFix.body.data.actionTriggered === 'AUTO_RESUME',
    'Automatically triggers AUTO_RESUME state switch when motion is detected',
    resumedFix.body.data.actionTriggered
  );
  assert(resumedFix.body.data.tripStatus === 'active', 'Trip status restored to "active"');

  // --- PILLAR 5: STUCK-IN-TRAFFIC CHECK (5 MINS STILL WITH CONGESTION) ---
  console.log('\n--- 5. Algorithmic State Switching: Stuck-in-Traffic Detection ---');
  const trafficTripId = `trip_traffic_${Date.now()}`;
  await sessionValidationService.registerActiveTrip(trafficTripId, testUserId, destinationCoords);

  const trafficStartTime = Date.now();
  // Start stillness
  await request(app).post(`${env.API_PREFIX}/motion/activity`).send({
    tripId: trafficTripId,
    userId: testUserId,
    activity: 'STILL',
    confidence: 95,
    coordinates: [13.395, 52.518],
    speed: 0.0,
    timestamp: trafficStartTime,
  });

  // 5 minutes later with HEAVY traffic congestion
  const trafficStillFix = await request(app)
    .post(`${env.API_PREFIX}/motion/activity`)
    .send({
      tripId: trafficTripId,
      userId: testUserId,
      activity: 'STILL',
      confidence: 98,
      coordinates: [13.395, 52.518],
      speed: 0.0,
      trafficCongestionLevel: 'HEAVY', // Heavy traffic on corridor
      timestamp: trafficStartTime + 305000,
    });

  assert(
    trafficStillFix.body.data.actionTriggered === 'STUCK_IN_TRAFFIC_ALERT',
    'Infers "STUCK_IN_TRAFFIC_ALERT" when stationary in heavy congestion',
    trafficStillFix.body.data.actionTriggered
  );
  assert(
    trafficStillFix.body.data.automatedPing?.actionType === 'CHECK_TRAFFIC',
    'Automated ping offers traffic check & dynamic reroute option',
    trafficStillFix.body.data.automatedPing?.message
  );

  // --- PILLAR 6: ARRIVED AT DESTINATION DETECTION (5 MINS STILL NEAR TARGET) ---
  console.log('\n--- 6. Algorithmic State Switching: Destination Arrival Detection ---');
  const arrivalTripId = `trip_arrival_${Date.now()}`;
  await sessionValidationService.registerActiveTrip(arrivalTripId, testUserId, destinationCoords);

  const arrivalStartTime = Date.now();
  // Stopped directly within 50m of Alexanderplatz destination [13.4114, 52.5218]
  const nearDestCoords: [number, number] = [13.4115, 52.5219];

  await request(app).post(`${env.API_PREFIX}/motion/activity`).send({
    tripId: arrivalTripId,
    userId: testUserId,
    activity: 'STILL',
    confidence: 100,
    coordinates: nearDestCoords,
    speed: 0.0,
    timestamp: arrivalStartTime,
  });

  // 5 minutes later still stopped near destination
  const arrivalStillFix = await request(app)
    .post(`${env.API_PREFIX}/motion/activity`)
    .send({
      tripId: arrivalTripId,
      userId: testUserId,
      activity: 'STILL',
      confidence: 100,
      coordinates: nearDestCoords,
      speed: 0.0,
      timestamp: arrivalStartTime + 305000,
    });

  assert(
    arrivalStillFix.body.data.actionTriggered === 'ARRIVAL_CONFIRMATION',
    'Infers "ARRIVAL_CONFIRMATION" when stationary for >5 mins within 150m of destination',
    arrivalStillFix.body.data.actionTriggered
  );
  assert(
    arrivalStillFix.body.data.automatedPing?.actionType === 'CONFIRM_ARRIVAL',
    'Automated ping prompts user to confirm arrival and complete trip',
    arrivalStillFix.body.data.automatedPing?.title
  );

  // --- PILLAR 7: CONTEXT-AWARE ROUTING PROFILE SWITCHING ---
  console.log('\n--- 7. Context-Aware Routing Mode Adaptation (Driver to Last-Mile Walk) ---');
  const walkTransitionFix = await request(app)
    .post(`${env.API_PREFIX}/motion/activity`)
    .send({
      tripId: arrivalTripId,
      userId: testUserId,
      activity: 'WALKING', // Driver stepped out of vehicle
      confidence: 90,
      coordinates: [13.410, 52.521], // 200m from destination
      speed: 4.5, // 4.5 km/h walking pace
    });

  assert(
    walkTransitionFix.body.data.actionTriggered === 'MODE_SWITCH_SUGGESTION',
    'Recognizes driver transitioned to walking near destination',
    walkTransitionFix.body.data.actionTriggered
  );
  assert(
    walkTransitionFix.body.data.contextAwareRouting?.suggestedProfile === 'foot',
    'Suggests switching routing profile to "foot" for Last-Mile pedestrian guidance',
    walkTransitionFix.body.data.contextAwareRouting?.reason
  );

  // --- PILLAR 8: MANUAL RESUME ENDPOINT ---
  console.log('\n--- 8. Manual Trip Resume API ---');
  const manualResume = await request(app)
    .post(`${env.API_PREFIX}/motion/resume`)
    .send({ tripId: testTripId });

  assert(manualResume.status === 200, 'Manual resume endpoint restores trip session');

  console.log('\n====================================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed`);
  console.log('====================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 PHYSICAL ACTIVITY & MOTION FITNESS SYSTEM FULLY VALIDATED!');
    process.exit(0);
  } else {
    console.error('💥 Some motion fitness tests failed.');
    process.exit(1);
  }
}

runMotionFitnessTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
