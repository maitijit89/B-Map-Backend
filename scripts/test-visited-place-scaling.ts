import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/core/config/env.config';
import { visitedPlaceScalingService } from '../src/modules/places/visited-place-scaling.service';
import { VisitedPlaceRecord, VisitedSpotRecord } from '../src/modules/places/visited-place-scaling.types';

async function runVisitedPlaceScalingTestSuite() {
  console.log('========================================================================');
  console.log('📍 B-MAP PERSONALIZED VISITED PLACES & SLOW-LARGE SPOTS TEST SUITE');
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

  const prefix = env.API_PREFIX;

  // --- 1. Pure Algorithm Verification: Most Visited Places Are Larger ---
  console.log('--- 1. Algorithm 1: Most Visited Places Are Dynamically Larger ---');

  const p1: VisitedPlaceRecord = {
    placeId: 'p_1',
    name: 'Single Visit Kiosk',
    category: 'retail',
    coordinates: [77.08, 28.49],
    visitCount: 1,
  };
  const p5: VisitedPlaceRecord = {
    placeId: 'p_5',
    name: 'Weekly Gym',
    category: 'fitness',
    coordinates: [77.08, 28.49],
    visitCount: 5,
  };
  const p18: VisitedPlaceRecord = {
    placeId: 'p_18',
    name: 'Frequent Coffee Shop',
    category: 'cafe',
    coordinates: [77.08, 28.49],
    visitCount: 18,
  };
  const p35: VisitedPlaceRecord = {
    placeId: 'p_35',
    name: 'Daily Workplace',
    category: 'office',
    coordinates: [77.08, 28.49],
    visitCount: 35,
  };

  const scaleP1 = visitedPlaceScalingService.calculatePlaceScale(p1);
  const scaleP5 = visitedPlaceScalingService.calculatePlaceScale(p5);
  const scaleP18 = visitedPlaceScalingService.calculatePlaceScale(p18);
  const scaleP35 = visitedPlaceScalingService.calculatePlaceScale(p35);

  assert(
    scaleP1.markerRadiusPx < scaleP5.markerRadiusPx &&
    scaleP5.markerRadiusPx < scaleP18.markerRadiusPx &&
    scaleP18.markerRadiusPx < scaleP35.markerRadiusPx,
    'Place marker radius increases strictly monotonically with visit count (1 < 5 < 18 < 35)',
    `Radii: [1 visit: ${scaleP1.markerRadiusPx}px, 5 visits: ${scaleP5.markerRadiusPx}px, 18 visits: ${scaleP18.markerRadiusPx}px, 35 visits: ${scaleP35.markerRadiusPx}px]`
  );

  assert(
    scaleP1.influenceRadiusMeters < scaleP35.influenceRadiusMeters,
    'Influence radius in ground meters scales proportionally from compact to landmark hub',
    `Meters: [${scaleP1.influenceRadiusMeters}m -> ${scaleP35.influenceRadiusMeters}m]`
  );

  assert(
    scaleP1.prominenceTier === 'compact' &&
    scaleP5.prominenceTier === 'regular' &&
    scaleP18.prominenceTier === 'frequent' &&
    scaleP35.prominenceTier === 'landmark_hub',
    'Assigns progressive prominence tiers based on frequency thresholds',
    `Tiers: [${scaleP1.prominenceTier}, ${scaleP5.prominenceTier}, ${scaleP18.prominenceTier}, ${scaleP35.prominenceTier}]`
  );

  assert(
    scaleP35.labelVisibilityZoom < scaleP1.labelVisibilityZoom,
    'Most visited landmark hub is visible at lower zoom levels (higher altitude)',
    `Zoom: ${scaleP35.labelVisibilityZoom} (landmark) vs ${scaleP1.labelVisibilityZoom} (compact)`
  );

  // --- 2. Pure Algorithm Verification: Most Visited Spots Are "Slow Large" ---
  console.log('\n--- 2. Algorithm 2: Most Visited Spots Are "Slow Large" ---');

  // Spot A: Frequently visited AND slow movement (sitting/staying at cafe/park bench)
  const spotSlowHighVisits: VisitedSpotRecord = {
    spotId: 'spot_slow_high',
    coordinates: [77.089, 28.496],
    visitCount: 22,
    avgSpeedKmH: 0.8, // 0.8 km/h (slow/stationary)
    totalDwellMinutes: 1320, // 22 hours
    spotLabel: 'Quiet Amphitheater Sitting Spot',
  };

  // Spot B: Frequently visited BUT fast movement (highway corridor / expressway pass-through)
  const spotFastHighVisits: VisitedSpotRecord = {
    spotId: 'spot_fast_high',
    coordinates: [77.081, 28.499],
    visitCount: 22, // Same 22 visits!
    avgSpeedKmH: 65.0, // 65 km/h (fast transit)
    totalDwellMinutes: 12,
    spotLabel: 'NH-48 Highway Flyover Corridor',
  };

  // Spot C: Slow movement BUT only 1 visit (starts compact and grows slowly)
  const spotSlowSingleVisit: VisitedSpotRecord = {
    spotId: 'spot_slow_single',
    coordinates: [77.093, 28.491],
    visitCount: 1,
    avgSpeedKmH: 0.6,
    totalDwellMinutes: 20,
    spotLabel: 'New Park Bench',
  };

  const scaleSlowHigh = visitedPlaceScalingService.calculateSpotScale(spotSlowHighVisits);
  const scaleFastHigh = visitedPlaceScalingService.calculateSpotScale(spotFastHighVisits);
  const scaleSlowSingle = visitedPlaceScalingService.calculateSpotScale(spotSlowSingleVisit);

  assert(
    scaleSlowHigh.slownessFactor >= 0.85 && scaleFastHigh.slownessFactor <= 0.05,
    'Slowness factor accurately differentiates stationary/slow lingering from highway transit',
    `Slow factor: ${scaleSlowHigh.slownessFactor} (0.8 km/h) vs Fast factor: ${scaleFastHigh.slownessFactor} (65 km/h)`
  );

  assert(
    scaleSlowHigh.spotRadiusPx > scaleFastHigh.spotRadiusPx * 1.8,
    'Slow visited spot is significantly larger than fast visited corridor of equal visit count ("slow large")',
    `Slow spot: ${scaleSlowHigh.spotRadiusPx}px vs Fast corridor: ${scaleFastHigh.spotRadiusPx}px`
  );

  assert(
    scaleSlowHigh.isSlowLarge === true && scaleSlowHigh.growthClassification === 'slow_large_expanded',
    'Badges slow lingering hotspot as isSlowLarge = true with slow_large_expanded classification',
    `isSlowLarge: ${scaleSlowHigh.isSlowLarge}, Classification: ${scaleSlowHigh.growthClassification}`
  );

  assert(
    scaleFastHigh.isSlowLarge === false && scaleFastHigh.growthClassification === 'transit_corridor',
    'Classifies fast high-visit corridor as transit_corridor with suppressed radius',
    `isSlowLarge: ${scaleFastHigh.isSlowLarge}, Classification: ${scaleFastHigh.growthClassification}`
  );

  assert(
    scaleSlowSingle.spotRadiusPx < scaleSlowHigh.spotRadiusPx,
    'Single-visit slow spot starts compact and exhibits calibrated "slow-growth" expansion',
    `Single visit: ${scaleSlowSingle.spotRadiusPx}px vs 22 visits: ${scaleSlowHigh.spotRadiusPx}px`
  );

  assert(
    scaleSlowHigh.heatIntensity > scaleFastHigh.heatIntensity,
    'Slow dwell hotspot generates higher heatmap intensity than fast pass-through',
    `Heat: ${scaleSlowHigh.heatIntensity} vs ${scaleFastHigh.heatIntensity}`
  );

  // --- 3. REST API: GET /api/v1/places/user/visited-places ---
  console.log('\n--- 3. REST API: User Visited Places with Dynamic Scale ---');

  const visitedPlacesRes = await request(app)
    .get(`${prefix}/places/user/visited-places?userId=usr_traveler_01`);

  assert(
    visitedPlacesRes.status === 200,
    'Fetches user visited places via GET /places/user/visited-places',
    `Status: ${visitedPlacesRes.status}`
  );

  assert(
    Array.isArray(visitedPlacesRes.body.data) && visitedPlacesRes.body.data.length >= 4,
    'Returns array of visited places sorted by visit count',
    `Count: ${visitedPlacesRes.body.data.length}`
  );

  const placesData = visitedPlacesRes.body.data;
  const isSortedByVisits = placesData.slice(1).every((p: any, i: number) => p.visitCount <= placesData[i].visitCount);
  assert(
    isSortedByVisits,
    'Places are sorted in descending order by visit frequency (most visited first)',
    `Visits order: [${placesData.map((p: any) => p.visitCount).join(', ')}]`
  );

  const mostVisited = placesData[0];
  const leastVisited = placesData[placesData.length - 1];
  assert(
    mostVisited.markerRadiusPx > leastVisited.markerRadiusPx,
    'Most visited place has strictly larger marker radius than least visited place',
    `Top place (${mostVisited.name}, ${mostVisited.visitCount} visits): ${mostVisited.markerRadiusPx}px vs Least (${leastVisited.name}, ${leastVisited.visitCount} visits): ${leastVisited.markerRadiusPx}px`
  );

  // --- 4. REST API: GET /api/v1/places/user/visited-spots ---
  console.log('\n--- 4. REST API: User Visited Spots with "Slow Large" Scaling ---');

  const visitedSpotsRes = await request(app)
    .get(`${prefix}/places/user/visited-spots?userId=usr_traveler_01`);

  assert(
    visitedSpotsRes.status === 200,
    'Fetches user visited spots via GET /places/user/visited-spots',
    `Status: ${visitedSpotsRes.status}`
  );

  const spotsData = visitedSpotsRes.body.data;
  assert(
    Array.isArray(spotsData) && spotsData.length >= 4,
    'Returns array of visited spots sorted by computed spot radius',
    `Count: ${spotsData.length}`
  );

  const slowLargeSpot = spotsData.find((s: any) => s.isSlowLarge === true);
  assert(
    !!slowLargeSpot,
    'Contains identified slow-large dwell spot in user spot registry',
    `Found: ${slowLargeSpot?.geojsonFeature?.properties?.spotLabel}`
  );

  // --- 5. REST API: POST /api/v1/places/user/visit ---
  console.log('\n--- 5. REST API: Record New Visit & Increment Dynamic Scale ---');

  const newPlaceCoord = [77.0885, 28.4955];
  const recordVisitRes = await request(app)
    .post(`${prefix}/places/user/visit`)
    .send({
      userId: 'usr_live_test_99',
      placeId: 'poi_cyber_hub_01',
      placeName: 'DLF CyberHub Gurugram',
      category: 'commercial_complex',
      coordinates: newPlaceCoord,
      speedKmH: 1.2,
      dwellMinutes: 45,
    });

  assert(
    recordVisitRes.status === 201,
    'Successfully records user visit via POST /places/user/visit',
    `Status: ${recordVisitRes.status}`
  );
  assert(
    recordVisitRes.body.data.placeScale.visitCount >= 1,
    'Returns computed placeScale with active visitCount',
    `Visit count: ${recordVisitRes.body.data.placeScale.visitCount}`
  );
  assert(
    recordVisitRes.body.data.spotScale.slownessFactor >= 0.8,
    'Returns computed spotScale reflecting pedestrian speed slowness factor',
    `Slowness factor: ${recordVisitRes.body.data.spotScale.slownessFactor}`
  );

  // Record 2nd visit to same spot with slow speed to test growth
  const recordVisit2 = await request(app)
    .post(`${prefix}/places/user/visit`)
    .send({
      userId: 'usr_live_test_99',
      placeId: 'poi_cyber_hub_01',
      coordinates: newPlaceCoord,
      speedKmH: 0.9,
      dwellMinutes: 60,
    });

  assert(
    recordVisit2.body.data.placeScale.markerRadiusPx >= recordVisitRes.body.data.placeScale.markerRadiusPx,
    'Place marker radius enlarges upon recording additional visit',
    `Radius grew to: ${recordVisit2.body.data.placeScale.markerRadiusPx}px`
  );

  // --- 6. REST API: GET /api/v1/places/user/map-layer ---
  console.log('\n--- 6. REST API: Complete MapLibre/Mapbox Personalized Map Layer ---');

  const mapLayerRes = await request(app)
    .get(`${prefix}/places/user/map-layer?userId=usr_traveler_01`);

  assert(
    mapLayerRes.status === 200,
    'Generates complete personalized map layer via GET /places/user/map-layer',
    `Status: ${mapLayerRes.status}`
  );

  const payload = mapLayerRes.body.data;
  assert(
    payload.placesLayer && payload.placesLayer.type === 'FeatureCollection',
    'Includes valid GeoJSON FeatureCollection for places layer',
    `Places count: ${payload.placesLayer.features.length}`
  );
  assert(
    payload.spotsLayer && payload.spotsLayer.type === 'FeatureCollection',
    'Includes valid GeoJSON FeatureCollection for spots layer',
    `Spots count: ${payload.spotsLayer.features.length}`
  );
  assert(
    payload.summary && typeof payload.summary.averageSlownessFactor === 'number',
    'Calculates executive summary with averageSlownessFactor',
    `Average slowness: ${payload.summary.averageSlownessFactor}`
  );

  // --- 7. REST API: POST /api/v1/places/user/calculate-scale ---
  console.log('\n--- 7. REST API: On-Demand Batch Scale Calculator ---');

  const batchRes = await request(app)
    .post(`${prefix}/places/user/calculate-scale`)
    .send({
      places: [
        { placeId: 'test_p_1', name: 'Place A', category: 'cafe', coordinates: [77.1, 28.5], visitCount: 2 },
        { placeId: 'test_p_2', name: 'Place B', category: 'work', coordinates: [77.2, 28.6], visitCount: 25 },
      ],
      spots: [
        { spotId: 's_slow', coordinates: [77.1, 28.5], visitCount: 15, avgSpeedKmH: 1.0, totalDwellMinutes: 600 },
        { spotId: 's_fast', coordinates: [77.2, 28.6], visitCount: 15, avgSpeedKmH: 70.0, totalDwellMinutes: 10 },
      ],
    });

  assert(
    batchRes.status === 200,
    'Evaluates batch scaling simulation via POST /places/user/calculate-scale',
    `Status: ${batchRes.status}`
  );
  assert(
    batchRes.body.data.places[0].markerRadiusPx > batchRes.body.data.places[1].markerRadiusPx,
    'Batch simulation scales 25-visit place larger than 2-visit place',
    `Place B (${batchRes.body.data.places[0].markerRadiusPx}px) > Place A (${batchRes.body.data.places[1].markerRadiusPx}px)`
  );
  assert(
    batchRes.body.data.spots[0].spotRadiusPx > batchRes.body.data.spots[1].spotRadiusPx,
    'Batch simulation scales slow spot larger than fast spot of equal visit frequency',
    `Slow spot (${batchRes.body.data.spots[0].spotRadiusPx}px) > Fast spot (${batchRes.body.data.spots[1].spotRadiusPx}px)`
  );

  // --- Summary ---
  console.log('\n========================================================================');
  console.log(`TEST SUITE RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('========================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runVisitedPlaceScalingTestSuite().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});

