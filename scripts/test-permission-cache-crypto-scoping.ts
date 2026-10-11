import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/core/config/env.config';
import { sessionValidationService } from '../src/modules/location-access/session-validation.service';
import { tripTokenService } from '../src/modules/location-access/trip-token.service';

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

async function runPermissionCacheAndCryptoScopingTestSuite() {
  console.log('========================================================================');
  console.log('🔒 B-MAP PERMISSION CACHING (REDIS) & STRICT CRYPTOGRAPHIC SCOPING TEST');
  console.log('========================================================================\n');

  // =========================================================================
  // SECTION 1: PERMISSION STATE CACHING (REDIS & IN-MEMORY MAP)
  // =========================================================================
  console.log('--- 1. Permission State Caching (Redis & In-Memory Map) ---');

  const testUserId = `user_cache_${Date.now()}`;
  const testTripId = `trip_cache_${Date.now()}`;
  const destinationCoords: [number, number] = [77.0872, 28.4947];

  await sessionValidationService.registerActiveTrip(testTripId, testUserId, destinationCoords);

  // 1.1 Query initial permission state (defaults to granted)
  const initialPermsRes = await request(app)
    .get(`${env.API_PREFIX}/location/permissions/${testUserId}`);

  assert(initialPermsRes.status === 200, 'Fetches initial cached permission state (200 OK)');
  assert(
    initialPermsRes.body.data.backgroundLocation === 'granted',
    'Initial backgroundLocation is "granted"'
  );
  assert(
    initialPermsRes.body.data.pollingHalted === false,
    'Initial pollingHalted is false'
  );
  assert(
    initialPermsRes.body.data.socketExpectingTelemetry === true,
    'Initial socketExpectingTelemetry is true'
  );

  // 1.2 User transmits background location before revocation
  const preRevokeBgRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: testTripId,
      userId: testUserId,
      coordinates: [77.087, 28.494],
      appLifecycleMode: 'background',
    });

  assert(preRevokeBgRes.status === 200, 'Background update accepted when permission is active (200 OK)');
  assert(preRevokeBgRes.body.data.accepted === true, 'Telemetry accepted');

  // 1.3 User revokes background access
  console.log('\n--- 2. Instant Background Revocation & Polling Cessation ---');
  const revokeRes = await request(app)
    .post(`${env.API_PREFIX}/location/permissions/revoke`)
    .send({
      userId: testUserId,
      tripId: testTripId,
    });

  assert(revokeRes.status === 200, 'Revocation endpoint returns 200 OK');
  assert(revokeRes.body.data.revoked === true, 'Revocation status marked as true');
  assert(
    revokeRes.body.data.state.backgroundLocation === 'revoked',
    'Cached backgroundLocation status set to "revoked"'
  );
  assert(
    revokeRes.body.data.state.pollingHalted === true,
    'Backend instantly flags pollingHalted: true'
  );
  assert(
    revokeRes.body.data.state.socketExpectingTelemetry === false,
    'Backend ceases socket telemetry expectations (socketExpectingTelemetry: false)'
  );

  // 1.4 Immediate rejection of subsequent background updates
  const postRevokeBgRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: testTripId,
      userId: testUserId,
      coordinates: [77.087, 28.494],
      appLifecycleMode: 'background',
    });

  assert(postRevokeBgRes.status === 403, 'Strictly rejects background coordinates after permission revocation (HTTP 403)');
  assert(
    postRevokeBgRes.body.errorCode === 'PERMISSION_REVOKED_BACKGROUND_ACCESS',
    'Returns PERMISSION_REVOKED_BACKGROUND_ACCESS error code',
    postRevokeBgRes.body.errorCode
  );

  // 1.5 Foreground updates are still permitted
  const foregroundStillAllowedRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: testTripId,
      userId: testUserId,
      coordinates: [77.087, 28.494],
      appLifecycleMode: 'foreground',
    });

  assert(foregroundStillAllowedRes.status === 200, 'Foreground updates remain permitted when user actively views app');

  // =========================================================================
  // SECTION 2: STRICT CRYPTOGRAPHIC SCOPING (TRIP-SCOPED NAVIGATION JWT)
  // =========================================================================
  console.log('\n--- 3. Strict Cryptographic Scoping: Tokenize Navigation Trip ---');

  const cryptoTripId = `trip_crypto_${Date.now()}`;
  const cryptoUserId = `user_driver_${Date.now()}`;
  const openRouteId = `route_gurugram_cybercity_${Date.now()}`;

  // 2.1 Tokenize trip linked explicitly to open destination route
  const tokenizeRes = await request(app)
    .post(`${env.API_PREFIX}/location/session/tokenize-trip`)
    .send({
      userId: cryptoUserId,
      tripId: cryptoTripId,
      routeId: openRouteId,
      destinationCoordinates: destinationCoords,
      expiresInMinutes: 15,
    });

  assert(tokenizeRes.status === 201, 'Tokenizes navigation trip with 201 Created');
  assert(tokenizeRes.body.data.tripToken !== undefined, 'Issues signed trip telemetry JWT');
  assert(tokenizeRes.body.data.expiresInSeconds === 900, 'JWT expiry configured as 15 minutes (900s)');
  assert(tokenizeRes.body.data.routeId === openRouteId, 'JWT explicitly linked to open destination route');

  const validTripToken = tokenizeRes.body.data.tripToken;

  // 2.2 Rejection when raw coordinates sent without token on tokenized trip
  console.log('\n--- 4. Enforce Token Presence on Tokenized Trip ---');
  const missingTokenRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: cryptoTripId,
      userId: cryptoUserId,
      coordinates: [77.087, 28.494],
      appLifecycleMode: 'foreground',
      // Intentionally omitting tripToken
    });

  assert(missingTokenRes.status === 401, 'Rejects raw coordinate update without token on tokenized trip (HTTP 401 Unauthorized)');
  assert(
    missingTokenRes.body.errorCode === 'CRYPTOGRAPHIC_TOKEN_MISSING',
    'Returns CRYPTOGRAPHIC_TOKEN_MISSING error code'
  );

  // 2.3 Rejection of invalid / tampered token
  console.log('\n--- 5. Tampered & Expired Token Rejection ---');
  const tamperedTokenRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: cryptoTripId,
      userId: cryptoUserId,
      coordinates: [77.087, 28.494],
      appLifecycleMode: 'foreground',
      tripToken: `${validTripToken}tampered`,
    });

  assert(tamperedTokenRes.status === 401, 'Rejects tampered JWT (HTTP 401 Unauthorized)');
  assert(
    tamperedTokenRes.body.errorCode === 'CRYPTOGRAPHIC_TOKEN_INVALID',
    'Returns CRYPTOGRAPHIC_TOKEN_INVALID'
  );

  // 2.4 Rejection of expired token
  const expiredPayload = {
    sub: cryptoUserId,
    tripId: cryptoTripId,
    routeId: openRouteId,
    destinationCoordinates: destinationCoords,
    scope: 'telemetry:ingest',
    type: 'trip_scoped_token',
  };
  const expiredToken = jwt.sign(expiredPayload, env.JWT_SECRET, {
    expiresIn: '-1s', // Expired 1 second ago
    issuer: 'b-map-navigation-engine',
    audience: 'b-map-telemetry-client',
  });

  const expiredTokenRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: cryptoTripId,
      userId: cryptoUserId,
      coordinates: [77.087, 28.494],
      appLifecycleMode: 'foreground',
      tripToken: expiredToken,
    });

  assert(expiredTokenRes.status === 401, 'Rejects expired trip token (HTTP 401 Unauthorized)');
  assert(
    expiredTokenRes.body.errorCode === 'CRYPTOGRAPHIC_TOKEN_EXPIRED',
    'Returns CRYPTOGRAPHIC_TOKEN_EXPIRED'
  );

  // 2.5 Rejection when token tripId doesn't match payload tripId
  console.log('\n--- 6. Cryptographic Scope Alignment Checks ---');
  const otherTripId = `trip_attacker_${Date.now()}`;
  await sessionValidationService.registerActiveTrip(otherTripId, cryptoUserId, destinationCoords);

  const mismatchedTripRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: otherTripId,
      userId: cryptoUserId,
      coordinates: [77.087, 28.494],
      appLifecycleMode: 'foreground',
      tripToken: validTripToken, // Valid token for cryptoTripId, not otherTripId
    });

  assert(mismatchedTripRes.status === 403, 'Rejects trip ID mismatch (HTTP 403 Forbidden)');
  assert(
    mismatchedTripRes.body.errorCode === 'CRYPTOGRAPHIC_TRIP_MISMATCH',
    'Returns CRYPTOGRAPHIC_TRIP_MISMATCH error code'
  );

  // 2.6 Acceptance of valid token in body
  console.log('\n--- 7. Successful Cryptographically Scoped Telemetry Ingestion ---');
  const validBodyTokenRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: cryptoTripId,
      userId: cryptoUserId,
      coordinates: [77.087, 28.494],
      appLifecycleMode: 'foreground',
      tripToken: validTripToken,
    });

  assert(validBodyTokenRes.status === 200, 'Accepts telemetry with valid trip token in request body (200 OK)');
  assert(validBodyTokenRes.body.data.accepted === true, 'Telemetry accepted');

  // 2.7 Acceptance of valid token in Authorization Bearer header
  const validHeaderTokenRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .set('Authorization', `Bearer ${validTripToken}`)
    .send({
      tripId: cryptoTripId,
      userId: cryptoUserId,
      coordinates: [77.087, 28.494],
      appLifecycleMode: 'foreground',
    });

  assert(validHeaderTokenRes.status === 200, 'Accepts telemetry with valid trip token in Authorization header (200 OK)');

  // 2.8 Token Refresh for Active Open Route
  console.log('\n--- 8. Short-Lived Token Refresh & Route Closure ---');
  const refreshRes = await request(app)
    .post(`${env.API_PREFIX}/location/session/refresh-trip-token`)
    .send({
      tripToken: validTripToken,
      expiresInMinutes: 20,
    });

  assert(refreshRes.status === 200, 'Refreshes short-lived token while route is open (200 OK)');
  assert(refreshRes.body.data.tripToken !== undefined, 'Issues refreshed trip token');
  assert(refreshRes.body.data.expiresInSeconds === 1200, 'Refreshed token has updated 20m expiry (1200s)');

  // 2.9 Route Closure -> Rejection of subsequent updates
  await tripTokenService.closeDestinationRoute(cryptoTripId);

  const postClosureRes = await request(app)
    .post(`${env.API_PREFIX}/location/ingest`)
    .send({
      tripId: cryptoTripId,
      userId: cryptoUserId,
      coordinates: [77.087, 28.494],
      appLifecycleMode: 'foreground',
      tripToken: validTripToken,
    });

  assert(postClosureRes.status === 403, 'Rejects updates when open destination route is closed (HTTP 403 Forbidden)');
  assert(
    postClosureRes.body.errorCode === 'CRYPTOGRAPHIC_ROUTE_CLOSED',
    'Returns CRYPTOGRAPHIC_ROUTE_CLOSED error code'
  );

  console.log('\n========================================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed`);
  console.log('========================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 PERMISSION STATE CACHING (REDIS) & STRICT CRYPTOGRAPHIC SCOPING VALIDATED!');
    process.exit(0);
  } else {
    console.error('💥 Some permission caching or cryptographic scoping tests failed.');
    process.exit(1);
  }
}

runPermissionCacheAndCryptoScopingTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
