import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/core/config/env.config';
import { jwtService } from '../src/modules/auth/jwt.service';

async function runAdminTestSuite() {
  console.log('====================================================');
  console.log('🛡️  B-MAP BACKEND ADMIN SUITE VERIFICATION TEST');
  console.log('====================================================\n');

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

  // 1. Generate Admin and Non-Admin JWT tokens
  const adminToken = jwtService.generateToken({
    userId: 'usr_admin_root',
    email: env.ADMIN_EMAIL,
    role: 'admin',
    name: 'Administrator',
  });

  const userToken = jwtService.generateToken({
    userId: 'usr_regular_driver',
    email: 'driver@bmap.in',
    role: 'user',
    name: 'Regular Driver',
  });

  console.log('--- 1. Security & RBAC Enforcement ---');
  // Unauthenticated request should fail with 401
  const unauthRes = await request(app).get('/api/v1/admin/overview');
  assert(unauthRes.status === 401, 'Unauthorized request rejected with 401', `Status: ${unauthRes.status}`);

  // Regular user token should fail with 403
  const forbiddenRes = await request(app)
    .get('/api/v1/admin/overview')
    .set('Authorization', `Bearer ${userToken}`);
  assert(forbiddenRes.status === 403, 'Non-admin user rejected with 403 Forbidden', `Status: ${forbiddenRes.status}`);

  // Admin token should succeed
  const authRes = await request(app)
    .get('/api/v1/admin/overview')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(authRes.status === 200, 'Admin authorized successfully with 200 OK', `Status: ${authRes.status}`);
  assert(authRes.body.data.total_users !== undefined, 'Overview returns total_users', `Users: ${authRes.body.data.total_users}`);

  console.log('\n--- 2. Interactive Admin Web Dashboard UI ---');
  // Convenience redirect /admin -> /api/v1/admin/dashboard
  const redirectRes = await request(app).get('/admin');
  assert(redirectRes.status === 302, '/admin redirects to /api/v1/admin/dashboard', `Location: ${redirectRes.headers.location}`);

  // Direct dashboard GET returns HTML
  const dashRes = await request(app).get('/api/v1/admin/dashboard');
  assert(dashRes.status === 200, 'GET /admin/dashboard returns 200 OK');
  assert(dashRes.text.includes('B-Map Admin Console'), 'Dashboard HTML contains brand header');
  assert(dashRes.text.includes('Sovereign'), 'Dashboard HTML contains Sovereign Navigation title');

  console.log('\n--- 3. Executive Metrics & Analytics ---');
  const featRes = await request(app)
    .get('/api/v1/admin/analytics/feature-usage')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(featRes.status === 200 && Array.isArray(featRes.body.data), 'Feature usage analytics returned', `Items: ${featRes.body.data.length}`);

  const userAnalyticsRes = await request(app)
    .get('/api/v1/admin/analytics/users')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(userAnalyticsRes.status === 200 && Array.isArray(userAnalyticsRes.body.data), 'User growth analytics graph returned');

  console.log('\n--- 4. User Directory & CRUD Operations ---');
  // List users
  const listUsersRes = await request(app)
    .get('/api/v1/admin/users?limit=10')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(listUsersRes.status === 200 && listUsersRes.body.data.users.length > 0, 'Users directory retrieved', `Count: ${listUsersRes.body.data.users.length}`);

  // Create new user
  const newUserEmail = `test.pilot.${Date.now()}@bmap.in`;
  const createUserRes = await request(app)
    .post('/api/v1/admin/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Pilot Driver',
      email: newUserEmail,
      phoneNumber: '+91 9898989898',
      age: 30,
      role: 'user',
      isEmailVerified: true,
    });
  assert(createUserRes.status === 201, 'POST /api/v1/admin/users creates user', `User ID: ${createUserRes.body.data.id}`);

  const createdUserId = createUserRes.body.data.id;

  // Update user
  const updateUserRes = await request(app)
    .patch(`/api/v1/admin/users/${createdUserId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      role: 'admin',
      name: 'Pilot Lead',
    });
  assert(updateUserRes.status === 200 && updateUserRes.body.data.role === 'admin', 'PATCH /api/v1/admin/users/:id promotes user to admin');

  // User stats summary
  const userStatsRes = await request(app)
    .get('/api/v1/admin/users/stats')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(userStatsRes.status === 200, 'GET /api/v1/admin/users/stats returns user directory statistics');

  // Delete test user
  const deleteUserRes = await request(app)
    .delete(`/api/v1/admin/users/${createdUserId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(deleteUserRes.status === 200, 'DELETE /api/v1/admin/users/:id removes user');

  console.log('\n--- 5. System Health, Diagnostics & Cache ---');
  const healthRes = await request(app)
    .get('/api/v1/admin/system/health')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(healthRes.status === 200, 'GET /api/v1/admin/system/health returns report', `Status: ${healthRes.body.data.status}`);
  assert(healthRes.body.data.memory?.heap_used_mb > 0, 'Memory statistics present', `Heap: ${healthRes.body.data.memory.heap_used_mb} MB`);

  const cacheStatsRes = await request(app)
    .get('/api/v1/admin/system/cache')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(cacheStatsRes.status === 200, 'GET /api/v1/admin/system/cache returns cache metrics');

  const flushCacheRes = await request(app)
    .post('/api/v1/admin/system/cache/flush')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ type: 'routes' });
  assert(flushCacheRes.status === 200, 'POST /api/v1/admin/system/cache/flush flushes route keys');

  console.log('\n--- 6. Sovereign Feature Flags & Dynamic Config ---');
  const configRes = await request(app)
    .get('/api/v1/admin/system/config')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(configRes.status === 200, 'GET /api/v1/admin/system/config returns flags');
  assert(configRes.body.data.navic_enhancement_enabled === true, 'NavIC enhancement flag active by default');

  const updateConfigRes = await request(app)
    .patch('/api/v1/admin/system/config')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      maintenance_mode: false,
      off_route_threshold_meters: 50,
    });
  assert(updateConfigRes.status === 200 && updateConfigRes.body.data.off_route_threshold_meters === 50, 'PATCH /api/v1/admin/system/config updates threshold dynamically');

  console.log('\n--- 7. Traffic & Highway Weather Overrides ---');
  const trafficOverrideRes = await request(app)
    .post('/api/v1/admin/traffic/override')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      segment_id: 'TEST_NH48_EXP',
      road_name: 'NH-48 Jaipur Highway',
      congestion_level: 'DARK_RED',
      speed_factor: 0.2,
      incident_description: 'Overturned tractor trailer',
    });
  assert(trafficOverrideRes.status === 200, 'POST /api/v1/admin/traffic/override sets override');

  const listTrafficRes = await request(app)
    .get('/api/v1/admin/traffic/overrides')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(listTrafficRes.status === 200 && listTrafficRes.body.data.length > 0, 'GET /api/v1/admin/traffic/overrides lists active overrides');

  const deleteTrafficRes = await request(app)
    .delete('/api/v1/admin/traffic/override/TEST_NH48_EXP')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(deleteTrafficRes.status === 200, 'DELETE /api/v1/admin/traffic/override/:id removes override');

  // Weather override
  const weatherOverrideRes = await request(app)
    .post('/api/v1/admin/weather/override')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      highway_name: 'NE-4 Expressway',
      visibility_meters: 30,
      is_dense_fog_active: true,
      imd_alert_level: 'RED',
      safety_advisory: 'Dense fog alert on Delhi-Mumbai Expressway',
    });
  assert(weatherOverrideRes.status === 200, 'POST /api/v1/admin/weather/override injects weather advisory');

  const deleteWeatherRes = await request(app)
    .delete('/api/v1/admin/weather/override/NE-4%20Expressway')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(deleteWeatherRes.status === 200, 'DELETE /api/v1/admin/weather/override/:name cleans up advisory');

  console.log('\n--- 8. Road Hazard Moderation ---');
  const createHazardRes = await request(app)
    .post('/api/v1/admin/hazards')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      type: 'POTHOLE_CLUSTER',
      severity: 'CRITICAL',
      location: { latitude: 28.6139, longitude: 77.209 },
      description: 'Severe monsoon pothole cluster',
    });
  assert(createHazardRes.status === 201, 'POST /api/v1/admin/hazards creates official road hazard alert');

  const hazardId = createHazardRes.body.data.id;
  const verifyHazardRes = await request(app)
    .patch(`/api/v1/admin/hazards/${hazardId}/verify`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(verifyHazardRes.status === 200, 'PATCH /api/v1/admin/hazards/:id/verify confirms hazard report');

  const deleteHazardRes = await request(app)
    .delete(`/api/v1/admin/hazards/${hazardId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(deleteHazardRes.status === 200, 'DELETE /api/v1/admin/hazards/:id removes hazard');

  console.log('\n--- 9. Toll Plazas & FASTag Registry ---');
  const listTollsRes = await request(app)
    .get('/api/v1/admin/tolls')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(listTollsRes.status === 200 && listTollsRes.body.data.length > 0, 'GET /api/v1/admin/tolls returns plaza list', `Plazas: ${listTollsRes.body.data.length}`);

  const updateTollRes = await request(app)
    .patch('/api/v1/admin/tolls/toll_kherki_daula')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      singleTripINR: 85.0,
    });
  assert(updateTollRes.status === 200 && updateTollRes.body.data.singleTripINR === 85.0, 'PATCH /api/v1/admin/tolls/:id updates rates');

  console.log('\n--- 10. Emergency SOS Dispatch Console ---');
  const listSosRes = await request(app)
    .get('/api/v1/admin/emergency/incidents')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(listSosRes.status === 200 && listSosRes.body.data.length > 0, 'GET /api/v1/admin/emergency/incidents returns incidents');

  const incidentId = listSosRes.body.data[0].incident_id;
  const updateSosRes = await request(app)
    .patch(`/api/v1/admin/emergency/incidents/${incidentId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      status: 'RESOLVED',
      notes: 'Highway patrol reached site and cleared incident',
    });
  assert(updateSosRes.status === 200 && updateSosRes.body.data.status === 'RESOLVED', 'PATCH /api/v1/admin/emergency/incidents/:id updates incident status');

  console.log('\n--- 11. Administrative Audit Trail ---');
  const auditRes = await request(app)
    .get('/api/v1/admin/audit-logs?limit=10')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(auditRes.status === 200 && Array.isArray(auditRes.body.data), 'GET /api/v1/admin/audit-logs retrieves log feed', `Logs: ${auditRes.body.data.length}`);
  assert(auditRes.body.data.length > 0, 'Audit logs automatically capture previous actions');

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL ADMIN BACKEND FEATURES VERIFIED AND PASSING 100%!');
  } else {
    console.error('⚠️ SOME TESTS FAILED. PLEASE INSPECT LOGS ABOVE.');
    process.exit(1);
  }
}

runAdminTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
