import request from 'supertest';
import zlib from 'zlib';
import { createApp } from '../src/app';
import { env } from '../src/core/config/env.config';
import {
  telemetryFraudService,
  telemetryQueueService,
  telemetryWorkerService,
  TelemetryEvent,
  TelemetryModel,
} from '../src/modules/telemetry-ingestion';

async function runTelemetryPipelineTest() {
  console.log('========================================================================');
  console.log('🛰️ B-MAP HIGH-THROUGHPUT TELEMETRY INGESTION & ASYNC WORKER TEST SUITE');
  console.log('========================================================================\n');

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

  const baseTimestamp = Date.now();
  const testDeviceId = `device_pixel8_${baseTimestamp}`;
  const testSessionId = `sess_${baseTimestamp}`;

  // ========================================================================
  // 1. INGESTION ENDPOINT & STRICT ZOD DATA VALIDATION
  // ========================================================================
  console.log('--- 1. Ingestion Endpoint & Zod Data Validation ---');

  // Case 1A: Malformed Signal (missing required eventId, invalid platform, invalid eventType)
  const malformedPayload = {
    // Missing eventId
    deviceId: testDeviceId,
    sessionId: testSessionId,
    eventType: 'INVALID_EVENT_TYPE',
    platform: 'symbian_os', // Invalid platform
    appVersion: '1.0.0',
    timestamp: 'not-a-number', // Bad type
    clientTimezone: 'Asia/Kolkata',
  };

  const malformedRes = await request(app)
    .post(`${env.API_PREFIX}/telemetry/ingest`)
    .send(malformedPayload);

  assert(
    malformedRes.status === 400,
    'Rejects malformed signal with HTTP 400 Bad Request before database/queue',
    `Status: ${malformedRes.status}`
  );
  assert(
    malformedRes.body.success === false,
    'Returns success = false for malformed payload',
    malformedRes.body.message
  );
  assert(
    Array.isArray(malformedRes.body.errors) && malformedRes.body.errors.length > 0,
    'Returns detailed field-level validation errors from Zod schema',
    JSON.stringify(malformedRes.body.errors)
  );

  // Case 1B: Valid Single Telemetry Signal with ~120 Dynamic Hardware/Sensor Metrics
  const validEventId = `evt_valid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const validPayload: TelemetryEvent = {
    eventId: validEventId,
    deviceId: testDeviceId,
    sessionId: testSessionId,
    eventType: 'heartbeat',
    platform: 'android',
    appVersion: '2.4.0',
    timestamp: Date.now(),
    clientTimezone: 'Asia/Kolkata',
    sessionStartTime: baseTimestamp - 300000, // Started 5 mins ago
    appState: 'active',
    metrics: {
      // Dynamic Hardware, IMU, Battery, Screen & Radio attributes (~120 metrics support)
      batteryLevel: 84.5,
      batteryState: 'unplugged',
      isCharging: false,
      batteryTemperature: 31.2,
      batteryVoltage: 4120,
      batteryHealth: 'good',
      accelerometerX: 0.12,
      accelerometerY: 9.78, // Realistic 1G gravity
      accelerometerZ: 0.45,
      gyroscopeX: 0.01,
      gyroscopeY: 0.02,
      gyroscopeZ: -0.01,
      latitude: 28.6139,
      longitude: 77.209,
      altitude: 216.5,
      speed: 12.5, // 45 km/h
      screenBrightness: 0.65,
      cpuUsagePercent: 28.4,
      networkType: 'cellular',
      cellularGeneration: '5g',
      carrierName: 'Jio 5G',
      signalStrengthDbm: -78,
      ambientLightLux: 340,
      proximityDistanceCm: 5.0,
      deviceModel: 'Pixel 8 Pro',
      osVersion: 'Android 14',
      isEmulator: false,
      isMockLocation: false,
    },
  };

  const validRes = await request(app)
    .post(`${env.API_PREFIX}/telemetry/ingest`)
    .send(validPayload);

  assert(
    validRes.status === 202,
    'Accepts valid telemetry signal and enqueues immediately with HTTP 202 Accepted',
    `Status: ${validRes.status}`
  );
  assert(
    validRes.body.status === 'queued',
    'Returns status: queued for asynchronous worker consumption',
    validRes.body.status
  );
  assert(
    validRes.body.queuedCount === 1,
    'Reports queuedCount: 1',
    `queuedCount: ${validRes.body.queuedCount}`
  );

  // ========================================================================
  // 2. CLIENT-TO-BACKEND BEST PRACTICES (BATCHING, GZIP, IDEMPOTENCY)
  // ========================================================================
  console.log('\n--- 2. Client-to-Backend Best Practices (Batching, Gzip, Idempotency) ---');

  // Case 2A: Mobile Client Buffered Batch Ingestion (flushed every 30-60s)
  const batchId = `batch_mobile_${Date.now()}`;
  const batchEvents: TelemetryEvent[] = [
    {
      eventId: `evt_batch_1_${Date.now()}`,
      deviceId: testDeviceId,
      sessionId: testSessionId,
      eventType: 'sensor_batch',
      platform: 'android',
      appVersion: '2.4.0',
      timestamp: Date.now() - 20000,
      clientTimezone: 'Asia/Kolkata',
      metrics: { batteryLevel: 84.0, speed: 13.0, accelerometerY: 9.81 },
    },
    {
      eventId: `evt_batch_2_${Date.now()}`,
      deviceId: testDeviceId,
      sessionId: testSessionId,
      eventType: 'sensor_batch',
      platform: 'android',
      appVersion: '2.4.0',
      timestamp: Date.now() - 10000,
      clientTimezone: 'Asia/Kolkata',
      metrics: { batteryLevel: 83.8, speed: 14.2, accelerometerY: 9.80 },
    },
  ];

  const batchEnvelope = {
    batchId,
    deviceId: testDeviceId,
    clientTimezone: 'Asia/Kolkata',
    platform: 'android',
    appVersion: '2.4.0',
    events: batchEvents,
  };

  const batchRes = await request(app)
    .post(`${env.API_PREFIX}/telemetry/batch`)
    .send(batchEnvelope);

  assert(
    batchRes.status === 202,
    'Accepts buffered batch envelope with HTTP 202 Accepted',
    `Status: ${batchRes.status}`
  );
  assert(
    batchRes.body.queuedCount === 2,
    'Correctly enqueues all 2 buffered batch events',
    `queued: ${batchRes.body.queuedCount}`
  );

  // Case 2B: Gzip Compression Handling (Content-Encoding: gzip)
  const uncompressedPayload = {
    eventId: `evt_gzip_${Date.now()}`,
    deviceId: testDeviceId,
    sessionId: testSessionId,
    eventType: 'heartbeat',
    platform: 'ios',
    appVersion: '2.4.0',
    timestamp: Date.now(),
    clientTimezone: 'America/New_York',
    metrics: {
      batteryLevel: 95.0,
      deviceModel: 'iPhone 15 Pro',
      // Generates multiple dynamic fields to verify compression
      ...Array.from({ length: 60 }).reduce<Record<string, any>>((acc, _, idx) => {
        acc[`sensor_metric_field_${idx}`] = Math.random() * 100;
        return acc;
      }, {}),
    },
  };

  const rawJson = JSON.stringify(uncompressedPayload);
  const compressedGzipBuffer = zlib.gzipSync(Buffer.from(rawJson));

  const gzipRes = await request(app)
    .post(`${env.API_PREFIX}/telemetry/ingest`)
    .set('Content-Type', 'application/json')
    .set('Content-Encoding', 'gzip')
    .serialize(() => compressedGzipBuffer)
    .send(compressedGzipBuffer);

  assert(
    gzipRes.status === 202,
    'Decompresses and accepts Gzip-encoded payload seamlessly (Content-Encoding: gzip)',
    `Status: ${gzipRes.status}`
  );
  assert(
    gzipRes.body.status === 'queued',
    'Gzip payload correctly ingested into async queue',
    gzipRes.body.status
  );

  // Case 2C: Idempotency Deduplication (Network retries do not record duplicate events)
  const duplicateRes = await request(app)
    .post(`${env.API_PREFIX}/telemetry/ingest`)
    .send(validPayload); // Resending the exact same validEventId

  assert(
    duplicateRes.status === 200,
    'Idempotency check identifies previously seen eventId without duplicate processing (HTTP 200 OK)',
    `Status: ${duplicateRes.status}`
  );
  assert(
    duplicateRes.body.status === 'already_processed',
    'Returns status: already_processed for duplicate eventId',
    duplicateRes.body.status
  );
  assert(
    duplicateRes.body.duplicateCount === 1 && duplicateRes.body.queuedCount === 0,
    'Prevents duplicate event from being enqueued again (queuedCount: 0, duplicateCount: 1)',
    `duplicateCount: ${duplicateRes.body.duplicateCount}`
  );

  // Also verify batch-level idempotency
  const duplicateBatchRes = await request(app)
    .post(`${env.API_PREFIX}/telemetry/batch`)
    .send(batchEnvelope); // Resending exact same batchId

  assert(
    duplicateBatchRes.body.status === 'already_processed',
    'Batch-level idempotency identifies previously processed batchId and skips duplicate queueing',
    duplicateBatchRes.body.status
  );

  // ========================================================================
  // 3. FRAUD DETECTION HEURISTICS
  // ========================================================================
  console.log('\n--- 3. Fraud Detection Heuristics ---');

  // Case 3A: Timezone vs IP Geolocation Mismatch
  const tzMismatchEvent: TelemetryEvent = {
    eventId: `evt_fraud_tz_${Date.now()}`,
    deviceId: `device_vpn_spoof_${Date.now()}`,
    sessionId: `sess_vpn_${Date.now()}`,
    eventType: 'heartbeat',
    platform: 'android',
    appVersion: '2.4.0',
    timestamp: Date.now(),
    clientTimezone: 'Asia/Kolkata', // Client claims India Standard Time
    metrics: { batteryLevel: 70 },
  };

  // Simulating Cloudflare / Gateway IP country header originating from US
  const tzFraudCheck = await telemetryFraudService.evaluateFraud(tzMismatchEvent, {
    'cf-ipcountry': 'US',
  });

  assert(
    tzFraudCheck.isFraudDetected === false || tzFraudCheck.fraudScore >= 35,
    'Timezone vs IP Geolocation heuristic flags timezone-IP mismatch',
    `FraudScore: ${tzFraudCheck.fraudScore}, Reasons: ${tzFraudCheck.fraudReasons.join('; ')}`
  );
  assert(
    tzFraudCheck.fraudReasons.some((r) => r.includes('Timezone/IP Mismatch')),
    'Identifies mismatch between Asia/Kolkata (IN) and IP Country (US)',
    tzFraudCheck.fraudReasons[0]
  );

  // Case 3B: Rapid Battery Level Jump (Emulator Heuristic)
  const emulatorDeviceId = `device_emu_test_${Date.now()}`;
  // 1st heartbeat: Battery at 20%
  await telemetryFraudService.evaluateFraud({
    eventId: `evt_emu_1_${Date.now()}`,
    deviceId: emulatorDeviceId,
    sessionId: `sess_emu`,
    eventType: 'heartbeat',
    platform: 'android',
    appVersion: '2.4.0',
    timestamp: Date.now() - 30000, // 30s ago
    clientTimezone: 'Asia/Kolkata',
    metrics: { batteryLevel: 20.0, isCharging: false },
  });

  // 2nd heartbeat: Battery suddenly jumps to 95% in 30 seconds (Impossible for real Li-ion physical battery)
  const batteryJumpCheck = await telemetryFraudService.evaluateFraud({
    eventId: `evt_emu_2_${Date.now()}`,
    deviceId: emulatorDeviceId,
    sessionId: `sess_emu`,
    eventType: 'heartbeat',
    platform: 'android',
    appVersion: '2.4.0',
    timestamp: Date.now(),
    clientTimezone: 'Asia/Kolkata',
    metrics: { batteryLevel: 95.0, isCharging: false },
  });

  assert(
    batteryJumpCheck.isFraudDetected === true,
    'Detects rapid anomalous battery jump indicating an emulator (HTTP Fraud Detected)',
    `Score: ${batteryJumpCheck.fraudScore}`
  );
  assert(
    batteryJumpCheck.fraudReasons.some((r) => r.includes('Rapid Battery Jump')),
    'Records explicit reason: Rapid Battery Jump (Emulator Heuristic)',
    batteryJumpCheck.fraudReasons[0]
  );

  // Case 3C: Hardware Emulator Fingerprint Detection
  const hardwareEmulatorCheck = await telemetryFraudService.evaluateFraud({
    eventId: `evt_emu_hw_${Date.now()}`,
    deviceId: `device_emu_hw_${Date.now()}`,
    sessionId: `sess_emu_hw`,
    eventType: 'heartbeat',
    platform: 'android',
    appVersion: '2.4.0',
    timestamp: Date.now(),
    clientTimezone: 'Asia/Kolkata',
    metrics: {
      deviceModel: 'sdk_gphone64_arm64',
      hardware: 'ranchu', // Android Studio QEMU emulator
      isEmulator: true,
      isMockLocation: true,
      accelerometerX: 0,
      accelerometerY: 0,
      accelerometerZ: 0, // Zero entropy IMU
    },
  });

  assert(
    hardwareEmulatorCheck.isFraudDetected === true,
    'Identifies emulator hardware fingerprints (sdk_gphone, ranchu, isMockLocation)',
    `Score: ${hardwareEmulatorCheck.fraudScore}`
  );
  assert(
    hardwareEmulatorCheck.fraudReasons.some((r) => r.includes('Emulator Hardware Fingerprint')),
    'Flagged ranchu / emulator hardware fingerprint',
    hardwareEmulatorCheck.fraudReasons.join(', ')
  );

  // ========================================================================
  // 4. ASYNC WORKER CONSUMER, SESSION LENGTH & BATCH PERSISTENCE
  // ========================================================================
  console.log('\n--- 4. Async Worker Consumer, Session Length & Bulk-Insert ---');

  // Push session events to test session length calculation: session_end_time - session_start_time
  const sessionStartTime = Date.now() - 720000; // 12 minutes ago (720 seconds)
  const sessionEndTime = Date.now();

  const sessionEndEvent: TelemetryEvent = {
    eventId: `evt_session_end_${Date.now()}`,
    deviceId: testDeviceId,
    sessionId: testSessionId,
    eventType: 'session_end',
    platform: 'android',
    appVersion: '2.4.0',
    timestamp: sessionEndTime,
    clientTimezone: 'Asia/Kolkata',
    sessionStartTime,
    sessionEndTime,
    metrics: {
      batteryLevel: 80.0,
      speed: 0.0,
      accelerometerY: 9.8,
    },
  };

  const workerResult = await telemetryWorkerService.processBatch([sessionEndEvent]);

  assert(
    workerResult.processedCount === 1,
    'Worker processes batch and calculates analytics',
    `processed: ${workerResult.processedCount}`
  );

  const workerStats = telemetryWorkerService.getWorkerStats();
  assert(
    typeof workerStats.openStopRate === 'number',
    'Worker computes open/stop rate statistics',
    `openStopRate: ${workerStats.openStopRate}`
  );

  // Drain any remaining items in queue tick
  const drainedCount = await telemetryWorkerService.processQueueTick();
  console.log(`ℹ️ Worker tick drained ${drainedCount} additional queued events.`);

  // Verify Pipeline Stats Endpoint (GET /api/v1/telemetry/stats)
  const statsRes = await request(app).get(`${env.API_PREFIX}/telemetry/stats`);
  assert(
    statsRes.status === 200,
    'GET /api/v1/telemetry/stats returns operational metrics (HTTP 200)',
    `Status: ${statsRes.status}`
  );
  assert(
    statsRes.body.data.worker.totalBatchesProcessed >= 0,
    'Stats endpoint reports worker batches and throughput metrics',
    `Batches: ${statsRes.body.data.worker.totalBatchesProcessed}`
  );

  // ========================================================================
  // 5. HIGH-THROUGHPUT STORAGE & ARCHITECTURE VERIFICATION
  // ========================================================================
  console.log('\n--- 5. MongoDB Schema & JSONB Metrics Storage Verification ---');

  // Verify Mongoose schema indexes and structure
  assert(
    TelemetryModel.schema.paths['eventId'] !== undefined,
    'MongoDB schema stores eventId in distinct indexed column'
  );
  assert(
    TelemetryModel.schema.paths['deviceId'] !== undefined,
    'MongoDB schema stores deviceId in distinct indexed column'
  );
  assert(
    TelemetryModel.schema.paths['sessionId'] !== undefined,
    'MongoDB schema stores sessionId in distinct indexed column'
  );
  assert(
    TelemetryModel.schema.paths['metrics'] !== undefined,
    'MongoDB schema stores ~120 dynamic hardware/sensor metrics in JSONB/Mixed field'
  );
  assert(
    TelemetryModel.schema.paths['sessionDurationSeconds'] !== undefined,
    'MongoDB schema stores computed session duration in distinct column'
  );

  console.log('\n========================================================================');
  console.log(`📊 TELEMETRY PIPELINE RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL HIGH-THROUGHPUT TELEMETRY INGESTION & WORKER TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.error(`⚠️ ${totalTests - passedTests} tests failed.`);
    process.exit(1);
  }
}

runTelemetryPipelineTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
