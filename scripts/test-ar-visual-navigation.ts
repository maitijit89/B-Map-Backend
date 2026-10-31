import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/core/config/env.config';
import { arVisualSearchService } from '../src/modules/ar-walk-cycle';

async function runARVisualNavigationTestSuite() {
  console.log('========================================================================');
  console.log('👓 B-MAP AR VISUAL NAVIGATION & AI PHOTO LANDMARK SEARCH TEST SUITE');
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

  // --- 1. Endpoint Contract & Input Validation ---
  console.log('--- 1. REST Endpoint Contract & Input Validation ---');

  const emptyRes = await request(app)
    .post(`${env.API_PREFIX}/ar-walk-cycle/visual-search`)
    .send({});

  assert(
    emptyRes.status === 400,
    'Rejects request missing image payload with HTTP 400 Bad Request',
    `Status: ${emptyRes.status}`
  );
  assert(
    emptyRes.body.success === false,
    'Returns standardized error envelope with success: false',
    emptyRes.body.message
  );

  // --- 2. Landmark A: India Gate (New Delhi) Visual Search ---
  console.log('\n--- 2. AI Visual Localization: India Gate (Triumphal Sandstone Arch) ---');

  const indiaGateRes = await request(app)
    .post(`${env.API_PREFIX}/ar-walk-cycle/visual-search`)
    .send({
      image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...[simulated_india_gate_photo]',
      hint: 'india gate war memorial kartavya path sandstone arch',
      userLocation: [77.2185, 28.6328], // User at Connaught Place
      cameraPose: {
        yawDegrees: 115,
        pitchDegrees: 0,
        fovHorizontalDegrees: 68,
      },
    });

  assert(
    indiaGateRes.status === 200,
    'Successfully processes location photo with HTTP 200 OK',
    `Status: ${indiaGateRes.status}`
  );
  const igData = indiaGateRes.body.data;
  assert(
    igData.topMatch.locationId === 'lm_india_gate_delhi',
    'Correctly identifies India Gate from visual signatures & OCR tokens',
    `LocationId: ${igData.topMatch.locationId}`
  );
  assert(
    igData.topMatch.confidenceScore >= 0.85,
    'Achieves high confidence score (>= 0.85)',
    `Confidence: ${(igData.topMatch.confidenceScore * 100).toFixed(1)}%`
  );
  assert(
    igData.topMatch.digipin.length > 0,
    'Generates calibrated 4m x 4m National DigiPIN micro-grid address',
    `DigiPIN: ${igData.topMatch.digipin}`
  );
  assert(
    igData.topMatch.city === 'New Delhi' && igData.topMatch.state === 'Delhi',
    'Correctly maps city and territorial jurisdiction',
    `${igData.topMatch.city}, ${igData.topMatch.state}`
  );
  assert(
    Array.isArray(igData.topMatch.visualEvidence) && igData.topMatch.visualEvidence.length > 0,
    'Provides multi-factor AI visual recognition evidence',
    igData.topMatch.visualEvidence[0]
  );

  // --- 3. Landmark B: DLF CyberHub (Commercial Tech Amphitheater) ---
  console.log('\n--- 3. AI Visual Localization: DLF CyberHub (Cyber City Gurugram) ---');

  const cyberHubRes = await request(app)
    .post(`${env.API_PREFIX}/ar-walk-cycle/visual-search`)
    .send({
      image: 'https://cdn.bmap.in/photos/gurugram_cyber_hub_amphitheater.webp',
      hint: 'cyberhub dlf cyber city building 10 rapid metro',
      userLocation: [77.0850, 28.4920], // User 400m away near DLF Gateway Tower
      cameraPose: {
        yawDegrees: 48,
        pitchDegrees: 2,
        fovHorizontalDegrees: 68,
      },
    });

  assert(
    cyberHubRes.status === 200,
    'Processes DLF CyberHub photo query with HTTP 200 OK',
    `Status: ${cyberHubRes.status}`
  );
  const chData = cyberHubRes.body.data;
  assert(
    chData.topMatch.locationId === 'lm_cyber_hub_gurugram',
    'Accurately pinpoints DLF CyberHub commercial tech park',
    `Name: ${chData.topMatch.name}`
  );
  assert(
    chData.topMatch.category === 'commercial_hub',
    'Classifies category as commercial_hub',
    `Category: ${chData.topMatch.category}`
  );
  assert(
    chData.arGuidance.distanceText.includes('m') || chData.arGuidance.distanceText.includes('km'),
    'Computes formatted direct distance from user coordinates',
    `Distance: ${chData.arGuidance.distanceText}`
  );
  assert(
    chData.arGuidance.clockDirection.includes('o\'clock'),
    'Computes intuitive clock-face direction relative to camera yaw',
    `Clock Direction: ${chData.arGuidance.clockDirection}`
  );

  // --- 4. EXIF GPS Metadata Header Extraction ---
  console.log('\n--- 4. Embedded EXIF GPS Extraction & Direct Geolocation ---');

  const sampleExif = arVisualSearchService.extractExifGpsMetadata('GPSLat: 28.6129, GPSLon: 77.2295');
  assert(
    sampleExif.hasGps === true,
    'Detects embedded EXIF GPS tags in image payload',
    `hasGps: ${sampleExif.hasGps}`
  );
  assert(
    sampleExif.latitude === 28.6129 && sampleExif.longitude === 77.2295,
    'Extracts exact latitude & longitude coordinates from EXIF',
    `[${sampleExif.longitude}, ${sampleExif.latitude}]`
  );

  // --- 5. AR Navigation Guidance & 3D HUD Screen Projections ---
  console.log('\n--- 5. AR Navigation Guidance & 3D HUD Frame Verification ---');

  const hud = igData.arGuidance.arHUDFrame;
  assert(
    hud && Array.isArray(hud.projectedAnchors) && hud.projectedAnchors.length > 0,
    'Generates 3D AR screen projection anchors',
    `Total Anchors: ${hud.projectedAnchors.length}`
  );
  const beacon = hud.projectedAnchors.find((a: any) => a.type === 'destination_beacon');
  assert(
    beacon !== undefined,
    'Includes 3D Destination Beacon hovering over identified landmark',
    beacon ? `Label: ${beacon.label}` : 'None'
  );
  assert(
    beacon && beacon.screenXPercent >= 0 && beacon.screenXPercent <= 100,
    'Projects beacon onto viewport horizontal percentage (0-100%)',
    beacon ? `ScreenX: ${beacon.screenXPercent}%` : 'None'
  );
  assert(
    igData.topMatch.walkingRoute !== undefined,
    'Generates turn-by-turn pedestrian walking route to target',
    `Walking distance: ${igData.topMatch.walkingRoute.totalDistanceMeters}m`
  );

  // --- 6. Alias Route: POST /api/v1/navigation/ar-visual-search ---
  console.log('\n--- 6. Navigation Domain Alias Endpoint ---');

  const aliasRes = await request(app)
    .post(`${env.API_PREFIX}/navigation/ar-visual-search`)
    .send({
      image: 'https://cdn.bmap.in/photos/mumbai_gateway.jpg',
      hint: 'gateway of india colaba taj hotel basalt arch',
      userLocation: [72.8300, 18.9200],
    });

  assert(
    aliasRes.status === 200,
    'Accessible via alias POST /api/v1/navigation/ar-visual-search',
    `Status: ${aliasRes.status}`
  );
  assert(
    aliasRes.body.data.topMatch.locationId === 'lm_gateway_of_india_mumbai',
    'Correctly identifies Gateway of India via navigation alias route',
    aliasRes.body.data.topMatch.name
  );

  // --- 7. Interactive Glassmorphic Web UI View ---
  console.log('\n--- 7. Interactive Web UI Endpoint Verification ---');

  const viewRes = await request(app).get(`${env.API_PREFIX}/ar-walk-cycle/view`);
  assert(
    viewRes.status === 200,
    'Serves interactive AR Visual Navigation Web UI with HTTP 200 OK',
    `Status: ${viewRes.status}`
  );
  assert(
    viewRes.headers['content-type'].includes('text/html'),
    'Serves HTML content type (text/html)',
    viewRes.headers['content-type']
  );
  assert(
    viewRes.text.includes('B-Map Sovereign Platform') && viewRes.text.includes('dropzone'),
    'Contains interactive drag & drop photo upload and AR camera HUD',
    'Verified UI markup'
  );

  // ========================================================================
  // TEST SUITE SUMMARY
  // ========================================================================
  console.log('\n========================================================================');
  console.log(`📊 AR VISUAL NAVIGATION RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL AR VISUAL LOCALIZATION & NAVIGATION TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runARVisualNavigationTestSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

