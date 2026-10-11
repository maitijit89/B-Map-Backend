import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/core/config/env.config';
import { sessionValidationService } from '../src/modules/location-access/session-validation.service';
import { geofenceTriggerService } from '../src/modules/notifications/geofence-trigger.service';
import { tokenManagementService } from '../src/modules/notifications/token-management.service';

async function runPushNotificationsTest() {
  console.log('========================================================================');
  console.log('🔔 B-MAP PUSH NOTIFICATIONS & REAL-TIME GEOFENCE TRIGGER ENGINE TEST');
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

  const customerUserId = `customer_${Date.now()}`;
  const driverUserId = `driver_${Date.now()}`;
  const testTripId = `trip_delivery_${Date.now()}`;

  // Customer drop-off / delivery address: Brandenburg Gate [13.377704, 52.516275]
  const destinationCoords: [number, number] = [13.377704, 52.516275];

  // Register active trip session
  await sessionValidationService.registerActiveTrip(testTripId, customerUserId, destinationCoords);
  geofenceTriggerService.resetTripMilestones(testTripId);
  console.log(`🗺️ Active delivery trip "${testTripId}" registered for customer "${customerUserId}".\n`);

  // --- PILLAR 1: TOKEN MANAGEMENT (FCM & APNS) ---
  console.log('--- 1. Device Push Token Registration & Management ---');

  // Register Android FCM Token
  const fcmToken = `fcm_token_device_android_${Date.now()}_abc123xyz`;
  const fcmRegisterRes = await request(app)
    .post(`${env.API_PREFIX}/notifications/devices/register`)
    .send({
      userId: customerUserId,
      token: fcmToken,
      platform: 'android',
      tokenType: 'fcm',
      deviceId: 'pixel_8_pro_01',
      deviceName: 'Google Pixel 8 Pro',
      appVersion: '0.1.2',
      permissions: {
        postNotifications: true, // Android 13+ POST_NOTIFICATIONS
        authorizationStatus: 'authorized',
      },
    });

  assert(fcmRegisterRes.status === 201, 'Registers Android FCM token with 201 Created');
  assert(fcmRegisterRes.body.data.platform === 'android', 'Platform recorded as android');
  assert(fcmRegisterRes.body.data.tokenType === 'fcm', 'Token type verified as FCM');

  // Register iOS APNs Token
  const apnsToken = 'e3a1f89c42b017de8923456789abcdef0123456789abcdef0123456789abcdef'; // 64-char hex APNs token
  const apnsRegisterRes = await request(app)
    .post(`${env.API_PREFIX}/notifications/devices/register`)
    .send({
      userId: customerUserId,
      token: apnsToken,
      platform: 'ios',
      tokenType: 'apns',
      deviceId: 'iphone_15_pro_max_01',
      deviceName: 'iPhone 15 Pro Max',
      appVersion: '0.1.2',
      permissions: {
        postNotifications: true, // iOS Remote Notifications (Always Allow)
        authorizationStatus: 'authorized',
      },
    });

  assert(apnsRegisterRes.status === 201, 'Registers iOS APNs token with 201 Created');
  assert(apnsRegisterRes.body.data.tokenType === 'apns', 'Token type verified as APNs');

  // Query registered devices for user
  const userDevicesRes = await request(app).get(
    `${env.API_PREFIX}/notifications/devices/${customerUserId}`
  );

  assert(userDevicesRes.status === 200, 'Fetches active user devices with 200 OK');
  assert(userDevicesRes.body.data.length >= 2, 'User has multiple registered devices (Android FCM + iOS APNs)', `Count: ${userDevicesRes.body.data.length}`);

  // --- PILLAR 2: TARGETED PUSH PAYLOAD FORMATTING & DISPATCH ---
  console.log('\n--- 2. Targeted Push Payload Generation (APNs & FCM) ---');
  const manualPushRes = await request(app)
    .post(`${env.API_PREFIX}/notifications/send-targeted`)
    .send({
      recipientUserId: customerUserId,
      title: 'Order Confirmed! 📦',
      body: 'Your delivery package is out for delivery with our driver.',
      data: {
        tripId: testTripId,
        orderId: 'ORD-98421',
      },
      priority: 'high',
      sound: 'default',
    });

  assert(manualPushRes.status === 200, 'Dispatches targeted push payload successfully');
  assert(manualPushRes.body.data.tokensTargetedCount >= 2, 'Payload targeted all customer active devices');

  // --- PILLAR 3: REAL-TIME GEOFENCE TRIGGER ENGINE (OUTSIDE GEOFENCE) ---
  console.log('\n--- 3. Outside Geofence (Driver 1.5 km away - No Trigger) ---');
  // Coordinates ~1.5 km away from Brandenburg Gate
  const driverFarCoords: [number, number] = [13.398, 52.520];

  const outsideGeofenceRes = await request(app)
    .post(`${env.API_PREFIX}/notifications/geofence/evaluate`)
    .send({
      tripId: testTripId,
      driverId: driverUserId,
      customerUserId,
      driverCoordinates: driverFarCoords,
      destinationCoordinates: destinationCoords,
    });

  assert(outsideGeofenceRes.status === 200, 'Evaluates distance outside geofence');
  assert(
    outsideGeofenceRes.body.data.milestoneTriggered === 'NONE',
    'No milestone triggered at 1.5km (> 500m)',
    `${outsideGeofenceRes.body.data.distanceToTargetMeters}m away`
  );
  assert(outsideGeofenceRes.body.data.pushDispatched === false, 'No push dispatched when far away');

  // --- PILLAR 4: 500-METER GEOFENCE MILESTONE TRIGGER ---
  console.log('\n--- 4. Real-time Trigger Engine: Driver 500 Meters Away ---');
  // Coordinates ~400 meters away from Brandenburg Gate (Potsdamer Platz north)
  const driver400mCoords: [number, number] = [13.377704, 52.512675]; // ~400m south

  const geofence500mRes = await request(app)
    .post(`${env.API_PREFIX}/notifications/geofence/evaluate`)
    .send({
      tripId: testTripId,
      driverId: driverUserId,
      customerUserId,
      driverCoordinates: driver400mCoords,
      destinationCoordinates: destinationCoords,
      etaSeconds: 120, // 2 minutes
    });

  assert(geofence500mRes.status === 200, 'Evaluates 500m geofence milestone');
  assert(
    geofence500mRes.body.data.milestoneTriggered === 'GEOFENCE_PROXIMITY_500M',
    'Triggers GEOFENCE_PROXIMITY_500M milestone',
    `${geofence500mRes.body.data.distanceToTargetMeters}m away`
  );
  assert(geofence500mRes.body.data.pushDispatched === true, 'Fires targeted push notification to customer phone');
  assert(
    geofence500mRes.body.data.targetedPushResult?.title.includes('Driver Approaching'),
    'Targeted title: "Driver Approaching! 🚗"',
    geofence500mRes.body.data.targetedPushResult?.title
  );
  assert(
    geofence500mRes.body.data.targetedPushResult?.body.includes('500 meters away'),
    'Targeted body informs customer of 500m distance and ETA',
    geofence500mRes.body.data.targetedPushResult?.body
  );

  // --- PILLAR 5: ANTI-DUPLICATION SPAM GUARD ---
  console.log('\n--- 5. Anti-Duplication Guard (Subsequent Pings Within 500m) ---');
  // Driver moves to 350m away on next 1-2s ping
  const driver350mCoords: [number, number] = [13.377704, 52.513125];

  const duplicateCheckRes = await request(app)
    .post(`${env.API_PREFIX}/notifications/geofence/evaluate`)
    .send({
      tripId: testTripId,
      driverId: driverUserId,
      customerUserId,
      driverCoordinates: driver350mCoords,
      destinationCoordinates: destinationCoords,
    });

  assert(duplicateCheckRes.status === 200, 'Evaluates subsequent 350m ping');
  assert(
    duplicateCheckRes.body.data.pushDispatched === false,
    'Prevents duplicate notification spam (500m milestone already fired)',
    `pushDispatched: ${duplicateCheckRes.body.data.pushDispatched}`
  );

  // --- PILLAR 6: 100-METER ARRIVAL GEOFENCE MILESTONE TRIGGER ---
  console.log('\n--- 6. Real-time Trigger Engine: Driver Arrived (Within 100 Meters) ---');
  // Driver arrives ~50m from Brandenburg Gate
  const driver50mCoords: [number, number] = [13.377704, 52.516725];

  const arrivalGeofenceRes = await request(app)
    .post(`${env.API_PREFIX}/notifications/geofence/evaluate`)
    .send({
      tripId: testTripId,
      driverId: driverUserId,
      customerUserId,
      driverCoordinates: driver50mCoords,
      destinationCoordinates: destinationCoords,
      etaSeconds: 0,
    });

  assert(arrivalGeofenceRes.status === 200, 'Evaluates arrival geofence');
  assert(
    arrivalGeofenceRes.body.data.milestoneTriggered === 'GEOFENCE_ARRIVAL_100M',
    'Triggers GEOFENCE_ARRIVAL_100M milestone',
    `${arrivalGeofenceRes.body.data.distanceToTargetMeters}m away`
  );
  assert(arrivalGeofenceRes.body.data.pushDispatched === true, 'Fires targeted arrival push notification to customer phone');
  assert(
    arrivalGeofenceRes.body.data.targetedPushResult?.title.includes('Driver Arrived'),
    'Arrival title: "Driver Arrived! 📍"',
    arrivalGeofenceRes.body.data.targetedPushResult?.title
  );

  // --- PILLAR 7: END-TO-END LOCATION INGESTION INTEGRATION ---
  console.log('\n--- 7. End-to-End Orchestration via /location/ingest ---');
  const e2eTripId = `trip_e2e_notif_${Date.now()}`;
  await sessionValidationService.registerActiveTrip(
    e2eTripId,
    customerUserId,
    destinationCoords,
    customerUserId,
    driverUserId
  );

  // Driver transmits background ping at 450m
  const ingestWithPushRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: e2eTripId,
      userId: driverUserId,
      coordinates: driver400mCoords,
      appLifecycleMode: 'background',
    });

  assert(ingestWithPushRes.status === 200, 'Ingests location and triggers geofence engine');
  assert(
    ingestWithPushRes.body.data.geofencePushTrigger?.pushDispatched === true,
    'Location ingestion automatically fires targeted 500m push notification to customer',
    ingestWithPushRes.body.data.geofencePushTrigger?.targetedPushResult?.title
  );

  // --- PILLAR 8: DEVICE TOKEN DE-REGISTRATION ---
  console.log('\n--- 8. Device Token De-Registration (Logout / Pruning) ---');
  const deregisterRes = await request(app)
    .delete(`${env.API_PREFIX}/notifications/devices/${fcmToken}`)
    .send({ userId: customerUserId });

  assert(deregisterRes.status === 200, 'De-registers FCM token on logout with 200 OK');

  console.log('\n========================================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed`);
  console.log('========================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 PUSH NOTIFICATIONS & REAL-TIME GEOFENCE TRIGGER ENGINE FULLY VALIDATED!');
    process.exit(0);
  } else {
    console.error('💥 Some push notifications tests failed.');
    process.exit(1);
  }
}

runPushNotificationsTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
