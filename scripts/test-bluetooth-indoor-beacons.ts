import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/core/config/env.config';
import { sessionValidationService } from '../src/modules/location-access/session-validation.service';

const app = createApp();

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}`, details ? `\nDetails: ${JSON.stringify(details, null, 2)}` : '');
  }
}

async function runBluetoothIndoorBeaconsTestSuite() {
  console.log('========================================================================');
  console.log('📡 B-MAP BLUETOOTH / NEARBY DEVICES & INDOOR BEACON MAPPING TEST SUITE');
  console.log('========================================================================\n');

  // --- PILLAR 1: CLIENT PERMISSION VERIFICATION ---
  console.log('--- 1. Client Bluetooth Permission Auditing (Android & iOS) ---');

  // 1.1 Android with BLUETOOTH_SCAN + BLUETOOTH_CONNECT
  const androidValidPermsRes = await request(app)
    .post(`${env.API_PREFIX}/nearby-devices/permissions/verify`)
    .send({
      platform: 'android',
      bluetoothScan: true,
      bluetoothConnect: true,
    });

  assert(androidValidPermsRes.status === 200, 'Android BLUETOOTH_SCAN + BLUETOOTH_CONNECT permissions verified (200 OK)');
  assert(
    androidValidPermsRes.body.data.isValid === true,
    'Android permission status is valid',
    androidValidPermsRes.body.data
  );

  // 1.2 Android missing permissions (denied scan)
  const androidDeniedRes = await request(app)
    .post(`${env.API_PREFIX}/nearby-devices/permissions/verify`)
    .send({
      platform: 'android',
      bluetoothScan: false,
      accessFineLocation: false,
    });

  assert(androidDeniedRes.status === 403, 'Rejects Android scan telemetry when BLUETOOTH_SCAN is denied (HTTP 403)');
  assert(
    androidDeniedRes.body.error === 'BLUETOOTH_PERMISSION_DENIED',
    'Returns BLUETOOTH_PERMISSION_DENIED error code'
  );

  // 1.3 iOS with Bluetooth Sharing authorized
  const iosValidPermsRes = await request(app)
    .post(`${env.API_PREFIX}/nearby-devices/permissions/verify`)
    .send({
      platform: 'ios',
      bluetoothSharing: true,
      authorizationStatus: 'authorized',
    });

  assert(iosValidPermsRes.status === 200, 'iOS Bluetooth Sharing (Remote Bluetooth) authorization verified (200 OK)');
  assert(iosValidPermsRes.body.data.isValid === true, 'iOS CoreBluetooth authorization is valid');

  // 1.4 iOS denied Bluetooth Sharing
  const iosDeniedRes = await request(app)
    .post(`${env.API_PREFIX}/nearby-devices/permissions/verify`)
    .send({
      platform: 'ios',
      bluetoothSharing: false,
      authorizationStatus: 'denied',
    });

  assert(iosDeniedRes.status === 403, 'Rejects iOS scan telemetry when Bluetooth Sharing is denied (HTTP 403)');

  // --- PILLAR 2: INDOOR MAPPING DATABASE QUERIES ---
  console.log('\n--- 2. Indoor Mapping Database Queries & Beacon Lookup ---');

  const listBeaconsRes = await request(app)
    .get(`${env.API_PREFIX}/nearby-devices/beacons`)
    .query({ facilityType: 'underground_parking' });

  assert(listBeaconsRes.status === 200, 'Queries indoor mapping database for underground parking beacons');
  assert(
    listBeaconsRes.body.count >= 4,
    `Retrieved calibrated parking beacons (count: ${listBeaconsRes.body.count})`
  );

  // Retrieve single beacon by ID (Cyber City Underground Garage B2, Pillar P-12)
  const singleBeaconRes = await request(app)
    .get(`${env.API_PREFIX}/nearby-devices/beacons/bcn_cybercity_b2_p12`);

  assert(singleBeaconRes.status === 200, 'Retrieves beacon details for "bcn_cybercity_b2_p12"');
  assert(singleBeaconRes.body.data.floorLevel === -2, 'Beacon floorLevel is -2 (Basement 2)');
  assert(singleBeaconRes.body.data.indoorX === 25.0, 'Indoor X is exactly 25.0m');
  assert(singleBeaconRes.body.data.indoorY === 40.0, 'Indoor Y is exactly 40.0m');
  assert(singleBeaconRes.body.data.zone.includes('Pillar P-12'), 'Zone: Pillar P-12, Blue Zone');

  // --- PILLAR 3: SINGLE BEACON NEAREST-PROXIMITY TRANSLATION ---
  console.log('\n--- 3. Single Beacon Nearest-Proximity Translation (Underground Garage) ---');

  const singleTranslationRes = await request(app)
    .post(`${env.API_PREFIX}/nearby-devices/beacons/translate`)
    .send({
      permissions: {
        platform: 'android',
        bluetoothScan: true,
        bluetoothConnect: true,
      },
      beacons: [
        {
          beaconId: 'bcn_cybercity_b2_p12',
          rssi: -62,
          txPower: -59,
        },
      ],
    });

  assert(singleTranslationRes.status === 200, 'Translates single scanned beacon successfully (200 OK)');
  const singleData = singleTranslationRes.body.data;
  assert(singleData.resolved === true, 'Position resolved successfully');
  assert(singleData.facilityId === 'fac_cybercity_gurugram', 'Identifies facility: DLF Cyber City');
  assert(singleData.floorLevel === -2, 'Identifies floor: Basement -2');
  assert(singleData.indoorCoordinates.x === 25.0, 'Indoor X is 25.0 meters');
  assert(singleData.indoorCoordinates.y === 40.0, 'Indoor Y is 40.0 meters');
  assert(singleData.localizationMethod === 'nearest_proximity', 'Method: nearest_proximity');
  assert(singleData.weakSignalContext.isWeakGpsArea === true, 'Weak GPS area flagged as true');
  assert(singleData.weakSignalContext.gpsReplacedByIndoorMap === true, 'GPS coordinates replaced by indoor map');

  // --- PILLAR 4: MULTI-BEACON WEIGHTED TRILATERATION ---
  console.log('\n--- 4. Multi-Beacon Weighted Centroid Trilateration (Parking Garage B2) ---');

  // User is located between Pillar P-12 (25, 40) and Pillar P-14 (35, 40) on Floor -2
  const multiBeaconsRes = await request(app)
    .post(`${env.API_PREFIX}/nearby-devices/beacons/translate`)
    .send({
      permissions: {
        platform: 'android',
        bluetoothScan: true,
        bluetoothConnect: true,
      },
      beacons: [
        { beaconId: 'bcn_cybercity_b2_p12', rssi: -63, txPower: -59 },
        { beaconId: 'bcn_cybercity_b2_p14', rssi: -64, txPower: -59 },
        { beaconId: 'bcn_cybercity_b2_p22', rssi: -78, txPower: -59 },
      ],
    });

  assert(multiBeaconsRes.status === 200, 'Translates multi-beacon scan with 200 OK');
  const multiData = multiBeaconsRes.body.data;
  assert(multiData.resolved === true, 'Multi-beacon fix resolved');
  assert(multiData.matchedBeaconsCount === 3, 'Matched all 3 beacons on floor -2');
  assert(multiData.floorLevel === -2, 'Floor isolated to -2');
  assert(multiData.localizationMethod === 'weighted_trilateration', 'Method: weighted_trilateration');
  // Expected X is roughly halfway between P-12 (25m) and P-14 (35m) around 29-31m
  assert(
    multiData.indoorCoordinates.x >= 27.0 && multiData.indoorCoordinates.x <= 33.0,
    `Calculates exact indoor X: ${multiData.indoorCoordinates.x}m (between P-12 25m & P-14 35m)`
  );
  assert(
    multiData.indoorCoordinates.y >= 39.0 && multiData.indoorCoordinates.y <= 45.0,
    `Calculates exact indoor Y: ${multiData.indoorCoordinates.y}m (near Y: 40m)`
  );
  assert(multiData.accuracyMeters <= 2.5, `High precision accuracy: ${multiData.accuracyMeters}m (< 2.5m)`);

  // --- PILLAR 5: MULTI-LEVEL FLOOR ISOLATION (PREVENTS FLOOR HOPPING) ---
  console.log('\n--- 5. Multi-Level Floor Isolation (Shopping Mall L1 vs B1 Bleed-through) ---');

  // In DLF Mall of India: User is on Level 1 (Atrium). B1 parking beacon bleeds through slab with weak RSSI
  const floorIsolationRes = await request(app)
    .post(`${env.API_PREFIX}/nearby-devices/beacons/translate`)
    .send({
      permissions: {
        platform: 'ios',
        bluetoothSharing: true,
        authorizationStatus: 'authorized',
      },
      beacons: [
        { beaconId: 'bcn_moi_l1_central_atrium', rssi: -58, txPower: -59 }, // Level 1 (Strong)
        { beaconId: 'bcn_moi_l1_zara_corridor', rssi: -64, txPower: -59 }, // Level 1 (Moderate)
        { beaconId: 'bcn_cybercity_b1_p08', rssi: -90, txPower: -59 }, // Basement Bleed-through (Very Weak)
      ],
    });

  assert(floorIsolationRes.status === 200, 'Translates shopping mall scan with 200 OK');
  const mallData = floorIsolationRes.body.data;
  assert(mallData.floorLevel === 1, 'Correctly isolates dominant floor Level 1 (excludes B1 bleed-through)');
  assert(mallData.facilityType === 'shopping_center', 'Facility type: shopping_center');
  assert(mallData.facilityId === 'fac_mall_of_india_noida', 'Facility: DLF Mall of India');
  assert(mallData.zone.includes('Central Atrium'), 'Zone: Central Atrium Fountain');

  // --- PILLAR 6: AIRPORT TERMINAL BAGGAGE RECLAIM MAPPING (ZERO GPS) ---
  console.log('\n--- 6. Airport Terminal Baggage Reclaim Mapping (Delhi IGI T3) ---');

  const airportRes = await request(app)
    .post(`${env.API_PREFIX}/nearby-devices/beacons/translate`)
    .send({
      permissions: {
        platform: 'android',
        bluetoothScan: true,
        bluetoothConnect: true,
      },
      beacons: [
        {
          uuid: '74278BDA-B644-4520-8F0C-720EAF059935',
          major: 3,
          minor: 5,
          rssi: -60,
          txPower: -59,
        },
        {
          uuid: '74278BDA-B644-4520-8F0C-720EAF059935',
          major: 3,
          minor: 6,
          rssi: -68,
          txPower: -59,
        },
      ],
    });

  assert(airportRes.status === 200, 'Translates iBeacon scan via (uuid, major, minor) tuples');
  assert(airportRes.body.data.facilityId === 'fac_igi_t3_delhi', 'Identifies Indira Gandhi International Airport T3');
  assert(airportRes.body.data.zone.includes('Baggage Belt 5'), 'Zone: Baggage Belt 5');
  assert(airportRes.body.data.indoorCoordinates.x >= 80.0, `Indoor X: ${airportRes.body.data.indoorCoordinates.x}m`);

  // --- PILLAR 7: END-TO-END LOCATION INGESTION INTEGRATION ---
  console.log('\n--- 7. End-to-End Orchestration via /location/ingest (Weak Signal Area) ---');

  const indoorTripId = `trip_underground_${Date.now()}`;
  const driverUserId = `driver_${Date.now()}`;
  await sessionValidationService.registerActiveTrip(indoorTripId, driverUserId, [77.0872, 28.4947]);

  // Telemetry payload sent from underground garage with weak GPS fix + scanned BLE beacons
  const ingestWithBeaconsRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: indoorTripId,
      userId: driverUserId,
      coordinates: [77.087, 28.494], // Stale/imprecise GPS
      appLifecycleMode: 'foreground',
      scannedBeacons: [
        { beaconId: 'bcn_cybercity_b2_p12', rssi: -60, txPower: -59 },
        { beaconId: 'bcn_cybercity_b2_p14', rssi: -63, txPower: -59 },
      ],
    });

  assert(ingestWithBeaconsRes.status === 200, 'Ingests location fix with BLE beacons');
  assert(
    ingestWithBeaconsRes.body.data.indoorBeaconPosition !== undefined,
    'Location ingestion response includes indoorBeaconPosition'
  );
  assert(
    ingestWithBeaconsRes.body.data.indoorBeaconPosition.resolved === true,
    'Indoor position fix successfully resolved inside underground parking garage'
  );
  assert(
    ingestWithBeaconsRes.body.data.indoorBeaconPosition.floorLevel === -2,
    'Ingestion accurately identifies driver is in Basement -2 parking'
  );

  // --- PILLAR 8: BEACON CALIBRATION REGISTRATION ---
  console.log('\n--- 8. Indoor Beacon Calibration & Registration API ---');

  const customBeaconId = `bcn_custom_garage_${Date.now()}`;
  const registerBeaconRes = await request(app)
    .post(`${env.API_PREFIX}/nearby-devices/beacons`)
    .send({
      beaconId: customBeaconId,
      facilityId: 'fac_custom_complex',
      facilityName: 'Custom Tech Park Multi-Level Garage',
      facilityType: 'underground_parking',
      floorLevel: -3,
      floorName: 'Basement Level 3 (Red Zone)',
      zone: 'Pillar R-05',
      indoorX: 18.5,
      indoorY: 55.0,
      indoorZ: 2.8,
      geographicLocation: [77.102, 28.512],
      altitudeMeters: 198.0,
      txPowerAt1m: -59,
      pathLossExponent: 2.8,
      coverageRadiusMeters: 25,
      protocol: 'ibeacon',
      status: 'active',
    });

  assert(registerBeaconRes.status === 201, 'Registers new calibrated beacon with 201 Created');
  assert(registerBeaconRes.body.data.beaconId === customBeaconId, 'Created beacon matches ID');

  console.log('\n========================================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed`);
  console.log('========================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 BLUETOOTH / NEARBY DEVICES & INDOOR BEACON MAPPING FULLY VALIDATED!');
    process.exit(0);
  } else {
    console.error('💥 Some indoor beacon mapping tests failed.');
    process.exit(1);
  }
}

runBluetoothIndoorBeaconsTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
