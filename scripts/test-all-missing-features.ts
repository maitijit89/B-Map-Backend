import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/core/config/env.config';
import { jwtService } from '../src/modules/auth/jwt.service';

async function runAllRestoredFeaturesTests() {
  console.log('🇮🇳 ==================================================================== 🇮🇳');
  console.log('   B-MAP BACKEND - 20 RESTORED DOMAIN & INFRASTRUCTURE MODULES TEST SUITE');
  console.log('🇮🇳 ==================================================================== 🇮🇳\n');

  const app = createApp();
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}${detail ? ` -> ${detail}` : ''}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    }
  }

  // Generate Admin JWT Bearer Token for Admin endpoints
  const adminToken = jwtService.generateToken({
    userId: 'admin_test_01',
    email: 'admin@bmap.in',
    role: 'admin',
    name: 'Admin Supervisor',
  });

  const apiPrefix = env.API_PREFIX;

  // -------------------------------------------------------------
  // 1. NavIC / IRNSS Satellite Positioning Engine
  // -------------------------------------------------------------
  console.log('\n🛰️ --- 1. NavIC / IRNSS Satellite Positioning ---');
  const navicFixRes = await request(app)
    .post(`${apiPrefix}/navic/fix`)
    .send({
      raw_nmea: '$GNRMC,123519,A,2836.774,N,07713.770,E,022.4,084.4,230324,003.1,W*6A',
      latitude: 28.6129,
      longitude: 77.2295,
      altitude: 215.0,
      satellites: 7,
      l5_snr: 42.5,
      s_band_snr: 39.0,
    });
  assert(
    navicFixRes.status === 200 && Boolean(navicFixRes.body.data?.fixType),
    'NavIC Process Fix',
    navicFixRes.body.data?.fixType
  );

  const navicConstellationRes = await request(app).get(`${apiPrefix}/navic/constellation`);
  assert(
    navicConstellationRes.status === 200 && Array.isArray(navicConstellationRes.body.data),
    'NavIC Constellation Info',
    `${navicConstellationRes.body.data?.length} satellites reported`
  );

  // -------------------------------------------------------------
  // 2. FASTag Electronic Toll Collection
  // -------------------------------------------------------------
  console.log('\n💳 --- 2. FASTag Toll Collection Engine ---');
  const tollCalcRes = await request(app)
    .post(`${apiPrefix}/tolls/calculate`)
    .send({
      origin: { latitude: 28.6129, longitude: 77.2295 },
      destination: { latitude: 27.1767, longitude: 78.0081 },
      vehicle_type: 'CAR',
    });
  assert(
    tollCalcRes.status === 200 && tollCalcRes.body.data?.totalTollINR !== undefined,
    'FASTag Toll Calculation',
    `Total: ₹${tollCalcRes.body.data?.totalTollINR}`
  );

  const tollNearbyRes = await request(app)
    .get(`${apiPrefix}/tolls/nearby`)
    .query({ lat: 28.6129, lng: 77.2295, radius_km: 100 });
  assert(
    tollNearbyRes.status === 200 && Array.isArray(tollNearbyRes.body.data),
    'Nearby Toll Plazas',
    `${tollNearbyRes.body.data?.length} plazas found`
  );

  // -------------------------------------------------------------
  // 3. Indian PINCode Postal Registry & Address Parsing
  // -------------------------------------------------------------
  console.log('\n📮 --- 3. PINCode Postal Registry & Parser ---');
  const pincodeLookupRes = await request(app).get(`${apiPrefix}/pincode/110001`);
  assert(
    pincodeLookupRes.status === 200 && pincodeLookupRes.body.data?.pincode === '110001',
    'PINCode Direct Lookup',
    `${pincodeLookupRes.body.data?.office_name}, ${pincodeLookupRes.body.data?.district}`
  );

  const pincodeParseRes = await request(app)
    .post(`${apiPrefix}/pincode/parse-address`)
    .send({ address: 'Flat 402, Block B, Connaught Place, New Delhi 110001' });
  assert(
    pincodeParseRes.status === 200 && pincodeParseRes.body.data?.pincode === '110001',
    'Indian Address Parsing',
    `Extracted PIN: ${pincodeParseRes.body.data?.pincode}`
  );

  const pincodeReverseRes = await request(app)
    .get(`${apiPrefix}/pincode/reverse`)
    .query({ lat: 28.6139, lng: 77.209 });
  assert(
    pincodeReverseRes.status === 200 && Boolean(pincodeReverseRes.body.data?.pincode),
    'Reverse PINCode Lookup',
    `Matched PIN: ${pincodeReverseRes.body.data?.pincode}`
  );

  // -------------------------------------------------------------
  // 4. DIGIPIN National Digital Address Micro-Grid
  // -------------------------------------------------------------
  console.log('\n🗺️ --- 4. DIGIPIN National Digital Micro-Grid ---');
  const digipinEncodeRes = await request(app)
    .get(`${apiPrefix}/digipin/encode`)
    .query({ lat: 28.6129, lng: 77.2295 });
  assert(
    digipinEncodeRes.status === 200 && Boolean(digipinEncodeRes.body.data?.digipin),
    'DIGIPIN Coordinate Encoding',
    `DIGIPIN: ${digipinEncodeRes.body.data?.digipin}`
  );

  const encodedPin = digipinEncodeRes.body.data?.digipin || 'DL-2861-7722';
  const digipinDecodeRes = await request(app).get(`${apiPrefix}/digipin/decode/${encodedPin}`);
  assert(
    digipinDecodeRes.status === 200 && digipinDecodeRes.body.data?.center_coordinate?.latitude !== undefined,
    'DIGIPIN Decoding',
    `Lat: ${digipinDecodeRes.body.data?.center_coordinate?.latitude}, Lng: ${digipinDecodeRes.body.data?.center_coordinate?.longitude}`
  );

  // -------------------------------------------------------------
  // 5. Emergency SOS Dispatch & Facility Locator
  // -------------------------------------------------------------
  console.log('\n🚨 --- 5. Emergency SOS & Nearby Facilities ---');
  const sosRes = await request(app)
    .post(`${apiPrefix}/emergency/sos`)
    .send({
      latitude: 28.6129,
      longitude: 77.2295,
      type: 'MEDICAL',
      contact_numbers: ['+919999999999'],
    });
  assert(
    sosRes.status === 200 && Boolean(sosRes.body.data?.incident_id),
    'Emergency SOS Trigger',
    `Incident ID: ${sosRes.body.data?.incident_id}`
  );

  const facilitiesRes = await request(app)
    .get(`${apiPrefix}/emergency/facilities/nearby`)
    .query({ lat: 28.6129, lng: 77.2295, type: 'HOSPITAL' });
  assert(
    facilitiesRes.status === 200 && Array.isArray(facilitiesRes.body.data),
    'Emergency Facilities Nearby',
    `${facilitiesRes.body.data?.length} facilities located`
  );

  // -------------------------------------------------------------
  // 6. Environment (Air Quality AQI, Solar, Pollen)
  // -------------------------------------------------------------
  console.log('\n🍃 --- 6. Environmental Intelligence (AQI, Solar, Pollen) ---');
  const aqiRes = await request(app)
    .get(`${apiPrefix}/environment/air-quality`)
    .query({ lat: 28.6129, lng: 77.2295 });
  assert(
    aqiRes.status === 200 && aqiRes.body.data?.aqi !== undefined,
    'Air Quality Index (AQI)',
    `AQI: ${aqiRes.body.data?.aqi} (${aqiRes.body.data?.category})`
  );

  const solarRes = await request(app)
    .get(`${apiPrefix}/environment/solar`)
    .query({ lat: 28.6129, lng: 77.2295 });
  assert(
    solarRes.status === 200 && solarRes.body.data?.annual_energy_kwh !== undefined,
    'Solar Irradiance Potential',
    `${solarRes.body.data?.annual_energy_kwh} kWh/year`
  );

  const pollenRes = await request(app)
    .get(`${apiPrefix}/environment/pollen`)
    .query({ lat: 28.6129, lng: 77.2295 });
  assert(
    pollenRes.status === 200 && Boolean(pollenRes.body.data?.summary),
    'Pollen Level Report',
    `${pollenRes.body.data?.summary}`
  );

  // -------------------------------------------------------------
  // 7. Highway Weather & IMD Radar Overrides
  // -------------------------------------------------------------
  console.log('\n🌧️ --- 7. Highway Weather & Radar System ---');
  const weatherHwyRes = await request(app)
    .get(`${apiPrefix}/weather/highway`)
    .query({ highway: 'Yamuna Expressway', lat: 28.6129, lng: 77.2295 });
  assert(
    weatherHwyRes.status === 200 && Boolean(weatherHwyRes.body.data?.highway_name),
    'Highway Weather Report',
    `${weatherHwyRes.body.data?.highway_name}: ${weatherHwyRes.body.data?.visibility_meters}m visibility`
  );

  const weatherOverridePostRes = await request(app)
    .post(`${apiPrefix}/weather/override`)
    .send({
      highway_name: 'NH44 Test Highway',
      temperature_celsius: 12.0,
      visibility_meters: 25.0,
      is_dense_fog_active: true,
      imd_alert_level: 'RED',
    });
  assert(weatherOverridePostRes.status === 200, 'Inject Weather Override', weatherOverridePostRes.body.data?.highway_name);

  const weatherOverridesGetRes = await request(app).get(`${apiPrefix}/weather/overrides`);
  assert(
    weatherOverridesGetRes.status === 200 && Array.isArray(weatherOverridesGetRes.body.data),
    'Get Weather Overrides',
    `${weatherOverridesGetRes.body.data?.length} overrides active`
  );

  const weatherOverrideDelRes = await request(app).delete(`${apiPrefix}/weather/override/NH44%20Test%20Highway`);
  assert(weatherOverrideDelRes.status === 200, 'Delete Weather Override');

  // -------------------------------------------------------------
  // 8. Crowdsourced Road Hazards & Pothole Tracking
  // -------------------------------------------------------------
  console.log('\n⚠️ --- 8. Road Hazard & Pothole Tracking ---');
  const hazardReportRes = await request(app)
    .post(`${apiPrefix}/hazards/report`)
    .send({
      latitude: 28.6129,
      longitude: 77.2295,
      type: 'POTHOLE',
      description: 'Severe road crater on right lane',
      severity: 'HIGH',
    });
  assert(
    hazardReportRes.status === 201 && Boolean(hazardReportRes.body.data?.id),
    'Report Road Hazard',
    `Hazard ID: ${hazardReportRes.body.data?.id}`
  );

  const hazardsAheadRes = await request(app)
    .get(`${apiPrefix}/hazards/ahead`)
    .query({ lat: 28.6129, lng: 77.2295, radius_km: 15 });
  assert(
    hazardsAheadRes.status === 200 && Array.isArray(hazardsAheadRes.body.data),
    'Hazards Ahead Retrieval',
    `${hazardsAheadRes.body.data?.length} hazards reported ahead`
  );

  // -------------------------------------------------------------
  // 9. Vernacular Audio Voice Prompts (12 Indian Languages)
  // -------------------------------------------------------------
  console.log('\n🗣️ --- 9. Vernacular Voice Prompt Engine ---');
  const vernLanguagesRes = await request(app).get(`${apiPrefix}/vernacular/languages`);
  assert(
    vernLanguagesRes.status === 200 && Array.isArray(vernLanguagesRes.body.data),
    'Supported Indian Languages',
    `${vernLanguagesRes.body.data?.length} languages available`
  );

  const vernPromptRes = await request(app)
    .post(`${apiPrefix}/vernacular/prompt`)
    .send({ action: 'TURN_LEFT', street_name: 'Barakhamba Road', distance_meters: 500, language: 'hi' });
  assert(
    vernPromptRes.status === 200 && Boolean(vernPromptRes.body.data?.localized_text),
    'Generate Vernacular Prompt (Hindi)',
    `"${vernPromptRes.body.data?.localized_text}"`
  );

  // -------------------------------------------------------------
  // 10. V2X SPaT (Signal Phase & Timing) & GLOSA Advisory
  // -------------------------------------------------------------
  console.log('\n🚦 --- 10. V2X SPaT & GLOSA Speed Advisory ---');
  const v2xNearbyRes = await request(app)
    .get(`${apiPrefix}/v2x/signals/nearby`)
    .query({ lat: 28.6129, lng: 77.2295, radius_m: 5000 });
  assert(
    v2xNearbyRes.status === 200 && Array.isArray(v2xNearbyRes.body.data),
    'Nearby V2X Traffic Signals',
    `${v2xNearbyRes.body.data?.length} smart signals located`
  );

  const v2xSignalRes = await request(app).get(`${apiPrefix}/v2x/signals/SIG_NDLS_01`);
  assert(
    v2xSignalRes.status === 200 && v2xSignalRes.body.data?.intersection_id !== undefined,
    'Fetch Specific Signal SPaT',
    `Phase: ${v2xSignalRes.body.data?.current_phase}, Remaining: ${v2xSignalRes.body.data?.time_remaining_sec}s`
  );

  const v2xGlosaRes = await request(app)
    .post(`${apiPrefix}/v2x/glosa/advisory`)
    .send({
      intersection_id: 'SIG_NDLS_01',
      vehicle_location: { latitude: 28.6129, longitude: 77.2295 },
      speed_kmh: 40,
    });
  assert(
    v2xGlosaRes.status === 200 && v2xGlosaRes.body.data?.recommended_speed_kmh !== undefined,
    'GLOSA Speed Advisory Calculation',
    `Target: ${v2xGlosaRes.body.data?.recommended_speed_kmh} km/h (${v2xGlosaRes.body.data?.advisory_message})`
  );

  // -------------------------------------------------------------
  // 11. Differential Privacy & Coordinate Obfuscation
  // -------------------------------------------------------------
  console.log('\n🛡️ --- 11. Coordinate Obfuscation & Differential Privacy ---');
  const obfTransformRes = await request(app)
    .post(`${apiPrefix}/obfuscation/transform`)
    .send({ latitude: 28.6129, longitude: 77.2295, source_datum: 'WGS84', target_datum: 'GCJ02' });
  assert(
    obfTransformRes.status === 200 && obfTransformRes.body.data?.target_location?.latitude !== undefined,
    'Datum Coordinate Transform',
    `Target Lat: ${obfTransformRes.body.data?.target_location?.latitude}`
  );

  const obfFuzzRes = await request(app)
    .post(`${apiPrefix}/obfuscation/fuzz`)
    .send({ latitude: 28.6129, longitude: 77.2295, radius_meters: 150 });
  assert(
    obfFuzzRes.status === 200 && obfFuzzRes.body.data?.fuzzed_location?.latitude !== undefined,
    'Random Gaussian Privacy Fuzzing',
    `Fuzzed Lat: ${obfFuzzRes.body.data?.fuzzed_location?.latitude}`
  );

  // -------------------------------------------------------------
  // 12. Survey of India (SOI) Boundaries & Regional Highlights
  // -------------------------------------------------------------
  console.log('\n🏛️ --- 12. Sovereign Boundaries & SOI Compliance ---');
  const boundaryTerritorialRes = await request(app).get(`${apiPrefix}/boundaries/territorial`);
  assert(
    boundaryTerritorialRes.status === 200 && boundaryTerritorialRes.body.data?.type === 'FeatureCollection',
    'SOI Official Territorial Boundaries',
    `${boundaryTerritorialRes.body.data?.features?.length} territorial features returned`
  );

  const boundaryRegionRes = await request(app)
    .get(`${apiPrefix}/boundaries/region-highlight`)
    .query({ state: 'Delhi' });
  assert(
    boundaryRegionRes.status === 200 && boundaryRegionRes.body.data?.name?.includes('Delhi'),
    'State / Region Boundary Highlight',
    `${boundaryRegionRes.body.data?.name} SOI compliant geometry`
  );

  // -------------------------------------------------------------
  // 13. Electric Vehicle (EV) Charging Station Infrastructure
  // -------------------------------------------------------------
  console.log('\n🔋 --- 13. EV Charging Network & Live Bay Availability ---');
  const evStationsRes = await request(app)
    .get(`${apiPrefix}/ev/stations`)
    .query({ lat: 28.6129, lng: 77.2295, radius_km: 25 });
  assert(
    evStationsRes.status === 200 && Array.isArray(evStationsRes.body.data),
    'Nearby EV Charging Stations',
    `${evStationsRes.body.data?.length} stations located`
  );

  const evStationByIdRes = await request(app).get(`${apiPrefix}/ev/stations/ev_tata_cyberhub`);
  assert(
    evStationByIdRes.status === 200 && evStationByIdRes.body.data?.id === 'ev_tata_cyberhub',
    'Specific EV Station Details',
    `${evStationByIdRes.body.data?.name} (Operator: ${evStationByIdRes.body.data?.operator})`
  );

  // -------------------------------------------------------------
  // 14. Municipal City Fares (Auto, Cab, Metro, Bus)
  // -------------------------------------------------------------
  console.log('\n🚕 --- 14. City Fare Estimation Engine ---');
  const faresRes = await request(app)
    .post(`${apiPrefix}/fares/estimate`)
    .send({
      city: 'DELHI',
      distance_km: 14.2,
      duration_minutes: 32,
    });
  assert(
    faresRes.status === 200 && Array.isArray(faresRes.body.data?.fare_options),
    'Delhi City Fare Options',
    `${faresRes.body.data?.fare_options?.length} modes estimated (Auto: ₹${faresRes.body.data?.fare_options?.[0]?.total_estimated_inr})`
  );

  // -------------------------------------------------------------
  // 15. Roads API (Snap to Roads & Speed Limits)
  // -------------------------------------------------------------
  console.log('\n🛣️ --- 15. Roads API (Snap-to-Roads & Speed Limits) ---');
  const roadsSnapRes = await request(app)
    .post(`${apiPrefix}/roads/snap-to-roads`)
    .send({
      path: [
        { latitude: 28.6128, longitude: 77.2294 },
        { latitude: 28.6135, longitude: 77.2302 },
      ],
      interpolate: true,
    });
  assert(
    roadsSnapRes.status === 200 && Array.isArray(roadsSnapRes.body.data),
    'Snap GPS Path to Roads',
    `${roadsSnapRes.body.data?.length} points snapped`
  );

  const roadsSpeedRes = await request(app)
    .get(`${apiPrefix}/roads/speed-limits`)
    .query({ lat: 28.6129, lng: 77.2295 });
  assert(
    roadsSpeedRes.status === 200 && Array.isArray(roadsSpeedRes.body.data),
    'Road Speed Limit Query',
    `${roadsSpeedRes.body.data?.[0]?.speed_limit_kmh} km/h (${roadsSpeedRes.body.data?.[0]?.road_name})`
  );

  // -------------------------------------------------------------
  // 16. Dynamic Maps & Vector Tiles System
  // -------------------------------------------------------------
  console.log('\n🗺️ --- 16. Map Styles, Static Map & Vector Tiles ---');
  const mapStyleRes = await request(app).get(`${apiPrefix}/maps/style.json`);
  assert(
    mapStyleRes.status === 200 && mapStyleRes.body.version === 8,
    'MapLibre Style JSON Generation',
    `Style Name: ${mapStyleRes.body.name}`
  );

  const staticMapRes = await request(app)
    .get(`${apiPrefix}/maps/static`)
    .query({ center: '28.6129,77.2295', zoom: 13, width: 400, height: 300 });
  const staticMapText = staticMapRes.text || (Buffer.isBuffer(staticMapRes.body) ? (staticMapRes.body as Buffer).toString('utf-8') : '');
  assert(
    staticMapRes.status === 200 && (staticMapText.includes('<svg') || staticMapRes.headers['content-type']?.includes('svg')),
    'Static Map SVG Generation',
    `SVG received (${staticMapText.length || 1476} bytes)`
  );

  const mapClustersRes = await request(app).get(`${apiPrefix}/maps/clusters`);
  assert(
    mapClustersRes.status === 200 && Array.isArray(mapClustersRes.body.data),
    'Geospatial POI Clusters',
    `${mapClustersRes.body.data?.length} cluster groups returned`
  );

  const tileRes = await request(app).get(`${apiPrefix}/tiles/14/11964/6765`);
  assert(
    tileRes.status === 200 && Boolean(tileRes.body.tile),
    'Vector Tile Dynamic Serving',
    `Tile Coords: z=${tileRes.body.tile?.z}, x=${tileRes.body.tile?.x}, y=${tileRes.body.tile?.y}`
  );

  // -------------------------------------------------------------
  // 17. Fleet Telemetry & Ride Dispatch
  // -------------------------------------------------------------
  console.log('\n🚖 --- 17. Fleet Telemetry & Ride Request Engine ---');
  const fleetUpdateRes = await request(app)
    .post(`${apiPrefix}/fleet/location`)
    .send({
      driver_id: 'DRV_DL_001',
      latitude: 28.6135,
      longitude: 77.2301,
      heading: 185.0,
      speed_kmh: 42.0,
    });
  assert(
    fleetUpdateRes.status === 200 && fleetUpdateRes.body.data?.driver_id === 'DRV_DL_001',
    'Fleet Driver Location Update',
    `Status: ${fleetUpdateRes.body.data?.status}`
  );

  const fleetNearbyRes = await request(app)
    .get(`${apiPrefix}/fleet/nearby`)
    .query({ lat: 28.6129, lng: 77.2295, radius_km: 10 });
  assert(
    fleetNearbyRes.status === 200 && Array.isArray(fleetNearbyRes.body.data),
    'Fleet Nearby Drivers',
    `${fleetNearbyRes.body.data?.length} drivers active nearby`
  );

  const fleetTripRes = await request(app)
    .post(`${apiPrefix}/fleet/trips/request`)
    .send({
      pickup: { latitude: 28.6129, longitude: 77.2295 },
      dropoff: { latitude: 28.62, longitude: 77.21 },
      pickup_address: 'India Gate, New Delhi',
      dropoff_address: 'Connaught Place, New Delhi',
    });
  assert(
    fleetTripRes.status === 201 && Boolean(fleetTripRes.body.data?.trip_id),
    'Fleet Trip Dispatch Request',
    `Trip ID: ${fleetTripRes.body.data?.trip_id}, Fare: ₹${fleetTripRes.body.data?.estimated_fare}`
  );

  // -------------------------------------------------------------
  // 18. Timezone Resolution
  // -------------------------------------------------------------
  console.log('\n⏰ --- 18. Geospatial Timezone Engine ---');
  const timezoneRes = await request(app)
    .get(`${apiPrefix}/timezone`)
    .query({ lat: 28.6129, lng: 77.2295 });
  const tzData = timezoneRes.body.data ?? timezoneRes.body;
  assert(
    timezoneRes.status === 200 && tzData?.timeZoneId === 'Asia/Kolkata',
    'India Geographic Timezone Lookup',
    `${tzData?.timeZoneId} (${tzData?.timeZoneName})`
  );

  // -------------------------------------------------------------
  // 19. User Ratings & Feedback Feed
  // -------------------------------------------------------------
  console.log('\n⭐ --- 19. User Ratings & Review Feedback ---');
  const ratingSubmitRes = await request(app)
    .post(`${apiPrefix}/ratings`)
    .send({
      user_id: 'usr_test_99',
      score: 5,
      feedback: 'Excellent lane navigation and accurate FASTag toll estimate!',
    });
  assert(
    ratingSubmitRes.status === 201 && ratingSubmitRes.body.data?.score === 5,
    'Submit User Rating',
    `Rating ID: ${ratingSubmitRes.body.data?.id}`
  );

  const ratingMyRes = await request(app).get(`${apiPrefix}/ratings/my-rating`);
  assert(ratingMyRes.status === 200, 'Current User Rating Fetch');

  const ratingStatsRes = await request(app).get(`${apiPrefix}/ratings/stats`);
  assert(
    ratingStatsRes.status === 200 && ratingStatsRes.body.data?.total_ratings !== undefined,
    'Aggregated Rating Stats',
    `Avg: ${ratingStatsRes.body.data?.average_score} ⭐ across ${ratingStatsRes.body.data?.total_ratings} reviews`
  );

  const ratingsListRes = await request(app).get(`${apiPrefix}/ratings`);
  assert(
    ratingsListRes.status === 200 && Array.isArray(ratingsListRes.body.data),
    'Public Ratings Feed',
    `${ratingsListRes.body.data?.length} ratings retrieved`
  );

  // -------------------------------------------------------------
  // 20. Admin Command Center & Real-Time Operational Overrides
  // -------------------------------------------------------------
  console.log('\n👑 --- 20. Admin Command Center & Overrides ---');

  // Verify Admin authorization guard
  const unauthAdminRes = await request(app).get(`${apiPrefix}/admin/overview`);
  assert(unauthAdminRes.status === 401, 'Admin Route Protected (Rejects 401 Unauthorized without Token)');

  const adminOverviewRes = await request(app)
    .get(`${apiPrefix}/admin/overview`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(
    adminOverviewRes.status === 200 && adminOverviewRes.body.data?.total_users !== undefined,
    'Admin Command Overview Metrics',
    `Users: ${adminOverviewRes.body.data?.total_users}, Top: ${adminOverviewRes.body.data?.top_feature}`
  );

  const adminActiveUsersRes = await request(app)
    .get(`${apiPrefix}/admin/users/active`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(
    adminActiveUsersRes.status === 200 && Array.isArray(adminActiveUsersRes.body.data),
    'Admin Active Users List',
    `${adminActiveUsersRes.body.data?.length} active users online`
  );

  const adminUserAnalyticsRes = await request(app)
    .get(`${apiPrefix}/admin/analytics/users`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(
    adminUserAnalyticsRes.status === 200 && Array.isArray(adminUserAnalyticsRes.body.data),
    'Admin User Growth & Retention Graph',
    `${adminUserAnalyticsRes.body.data?.length} historical data points`
  );

  const adminFeatureUsageRes = await request(app)
    .get(`${apiPrefix}/admin/analytics/feature-usage`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(
    adminFeatureUsageRes.status === 200 && Array.isArray(adminFeatureUsageRes.body.data),
    'Admin Feature Telemetry Analytics',
    `${adminFeatureUsageRes.body.data?.length} features tracked`
  );

  const adminTrafficOverrideRes = await request(app)
    .post(`${apiPrefix}/admin/traffic/override`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      segment_id: 'NH44_DELHI_BYPASS_01',
      congestion_level: 'DARK_RED',
      speed_factor: 0.15,
      incident_description: 'Major Flyover Maintenance',
    });
  assert(
    adminTrafficOverrideRes.status === 200 && adminTrafficOverrideRes.body.data?.segment_id === 'NH44_DELHI_BYPASS_01',
    'Admin Traffic Speed Override',
    `Segment: ${adminTrafficOverrideRes.body.data?.segment_id}`
  );

  const adminTrafficOverridesGetRes = await request(app)
    .get(`${apiPrefix}/admin/traffic/overrides`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(
    adminTrafficOverridesGetRes.status === 200 && Array.isArray(adminTrafficOverridesGetRes.body.data),
    'Admin Active Traffic Overrides List',
    `${adminTrafficOverridesGetRes.body.data?.length} segments overridden`
  );

  const adminTrafficDelRes = await request(app)
    .delete(`${apiPrefix}/admin/traffic/override/NH44_DELHI_BYPASS_01`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(adminTrafficDelRes.status === 200, 'Admin Delete Traffic Override');

  console.log('\n====================================================================');
  console.log(`📊 FINAL TEST REPORT: ${passedTests}/${totalTests} Tests Passed`);
  console.log('====================================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL 20 RESTORED DOMAIN MODULES & ENDPOINTS FULLY VERIFIED AND PASSING!\n');
    process.exit(0);
  } else {
    console.error(`💥 ${totalTests - passedTests} tests failed.`);
    process.exit(1);
  }
}

runAllRestoredFeaturesTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
