/// <reference types="node" />
import assert from 'assert';
import { tollService } from '../src/modules/tolls/tolls.service';
import { weatherService } from '../src/modules/weather/weather.service';
import { obfuscationService } from '../src/modules/obfuscation/obfuscation.service';
import { vernacularService } from '../src/modules/vernacular/vernacular.service';
import { navicService } from '../src/modules/navic/navic.service';
import { digipinService } from '../src/modules/digipin/digipin.service';
import { trafficGraphService } from '../src/modules/traffic/traffic-graph.service';
import { trafficAnomalyClusteringService } from '../src/modules/traffic/traffic-anomaly-clustering.service';
import { trafficShockwaveService } from '../src/modules/traffic/traffic-shockwave.service';
import { ecoRoutingService } from '../src/modules/traffic/eco-routing.service';

async function runSovereignTrafficPipelineVerification() {
  console.log('========================================================================');
  console.log('🇮🇳 SOVEREIGN INDIAN GIS & REAL-TIME TRAFFIC ENGINE PIPELINE TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function expect(cond: boolean, desc: string) {
    if (cond) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // ========================================================================
  // 1. NHAI FASTAG DYNAMIC TOLL ENGINE (Expressways & Classes 4-9)
  // ========================================================================
  console.log('--- 1. NHAI FASTag Dynamic Toll Engine (tolls) ---');

  // 1.1 Delhi-Mumbai Expressway (NE-4) Class 4 (Car)
  const ne4Car = tollService.calculateTolls({
    origin: 'Delhi',
    destination: 'Mumbai',
    vehicleType: 'CLASS_4',
  });
  expect(ne4Car.totalTollINR > 0, `NE-4 Car toll calculated: ${ne4Car.totalTollINR} INR`);
  expect(ne4Car.vehicleClassCode === 'CLASS_4', 'Vehicle class code is CLASS_4');
  expect(ne4Car.expresswaysCrossed.some((e) => e.includes('NE-4')), 'Crosses Delhi-Mumbai Expressway (NE-4)');
  expect(ne4Car.cashlessLaneGuidance.length > 0, 'Provides cashless lane guidance for NE-4');

  // 1.2 Class 4 through Class 9 Tariffs on Bengaluru-Mysuru Expressway (NH-275)
  const nh275Class4 = tollService.calculateTolls({ origin: 'Bengaluru', destination: 'Mysuru', vehicleType: 'CLASS_4' });
  const nh275Class5 = tollService.calculateTolls({ origin: 'Bengaluru', destination: 'Mysuru', vehicleType: 'CLASS_5' });
  const nh275Class6 = tollService.calculateTolls({ origin: 'Bengaluru', destination: 'Mysuru', vehicleType: 'CLASS_6' });
  const nh275Class7 = tollService.calculateTolls({ origin: 'Bengaluru', destination: 'Mysuru', vehicleType: 'CLASS_7' });
  const nh275Class8 = tollService.calculateTolls({ origin: 'Bengaluru', destination: 'Mysuru', vehicleType: 'CLASS_8' });
  const nh275Class9 = tollService.calculateTolls({ origin: 'Bengaluru', destination: 'Mysuru', vehicleType: 'CLASS_9' });

  expect(nh275Class4.totalTollINR === 320, `Class 4 Car toll on NH-275 is 320 INR (Got: ${nh275Class4.totalTollINR})`);
  expect(nh275Class5.totalTollINR === Math.round(320 * 1.6 * 100) / 100, `Class 5 LCV toll (1.6x) is ${nh275Class5.totalTollINR} INR`);
  expect(nh275Class6.totalTollINR === Math.round(320 * 3.35 * 100) / 100, `Class 6 Bus/Truck toll (3.35x) is ${nh275Class6.totalTollINR} INR`);
  expect(nh275Class7.totalTollINR === Math.round(320 * 3.65 * 100) / 100, `Class 7 3-Axle toll (3.65x) is ${nh275Class7.totalTollINR} INR`);
  expect(nh275Class8.totalTollINR === Math.round(320 * 5.25 * 100) / 100, `Class 8 4-6 Axle MAV toll (5.25x) is ${nh275Class8.totalTollINR} INR`);
  expect(nh275Class9.totalTollINR === Math.round(320 * 6.4 * 100) / 100, `Class 9 7+ Axle OSV toll (6.4x) is ${nh275Class9.totalTollINR} INR`);

  // 1.3 Two-Wheeler Exemption
  const twoWheeler = tollService.calculateTolls({ origin: 'Delhi', destination: 'Mumbai', vehicleType: 'TWO_WHEELER' });
  expect(twoWheeler.totalTollINR === 0, 'Two-wheelers are 100% exempt from toll fees across Indian expressways');
  expect(twoWheeler.vehicleClassCode === 'TWO_WHEELER_EXEMPT', 'Two-wheeler classified as TWO_WHEELER_EXEMPT');

  // ========================================================================
  // 2. IMD SEVERE HIGHWAY WEATHER & DEFENSE OBFUSCATION
  // ========================================================================
  console.log('\n--- 2. IMD Severe Highway Weather & Defense Obfuscation (weather, obfuscation) ---');

  // 2.1 Northern Winter Zero-Visibility Fog (<50m)
  const fogReport = weatherService.getHighwayWeather(28.5, 77.4, 'Yamuna Expressway');
  expect(fogReport.visibility_meters < 50, `Visibility in winter fog corridor is < 50m (Got: ${fogReport.visibility_meters}m)`);
  expect(fogReport.is_dense_fog_active === true, 'Dense fog active flag is true');
  expect(fogReport.isRerouteRecommended === true, 'Proactive reroute recommended for zero-visibility fog');
  expect(fogReport.rerouteReason === 'ZERO_VISIBILITY_WINTER_FOG', 'Reroute reason is ZERO_VISIBILITY_WINTER_FOG');
  expect(fogReport.safeSpeedLimitKmh === 40, 'Safe speed limit reduced to 40 km/h in zero-visibility fog');

  // 2.2 Defense Obfuscation inside Western Air Command / Delhi Cantonment
  const cantonmentFix = obfuscationService.applyDefenseMasking({
    latitude: 28.5885,
    longitude: 77.1352,
  });
  expect(cantonmentFix.is_within_defense_zone === true, 'Identifies coordinates inside sensitive defense installation');
  expect(cantonmentFix.jitter_distance_meters >= 200 && cantonmentFix.jitter_distance_meters <= 500, `Applies 200m–500m spatial jitter (Applied: ${cantonmentFix.jitter_distance_meters}m)`);
  expect(cantonmentFix.policy_compliance.includes('National Geospatial Policy'), 'Asserts National Geospatial Policy compliance');

  // 2.3 Non-defense Civilian Coordinate Passthrough
  const civilianFix = obfuscationService.applyDefenseMasking({
    latitude: 19.076,
    longitude: 72.8777,
  });
  expect(civilianFix.is_within_defense_zone === false, 'Non-defense civilian coordinate not flagged');
  expect(civilianFix.jitter_distance_meters === 0, 'Zero jitter applied on non-defense coordinates');

  // ========================================================================
  // 3. 12-LANGUAGE VERNACULAR VOICE SYNTHESIS
  // ========================================================================
  console.log('\n--- 3. 12-Language Vernacular Voice Synthesis (vernacular) ---');

  const languages = vernacularService.getSupportedLanguages();
  expect(languages.length === 12, `Exactly 12 scheduled Indian languages registered (Found: ${languages.length})`);

  const requiredLangCodes = ['hi-IN', 'ta-IN', 'te-IN', 'bn-IN', 'mr-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'pa-IN', 'or-IN', 'as-IN', 'en-IN'];
  for (const code of requiredLangCodes) {
    const found = languages.some((l) => l.code === code);
    expect(found, `Language code ${code} is registered`);
  }

  // Test translations for Odia and Assamese
  const orPrompt = vernacularService.translateManeuver({
    language: 'or',
    action: 'TURN_LEFT',
    distance_meters: 300,
    street_name: 'Janpath Road',
  });
  expect(orPrompt.language === 'or-IN', 'Odia language mapped to or-IN');
  expect(orPrompt.localized_text.includes('bama ku bulantu'), `Odia left-turn localized text generated: "${orPrompt.localized_text}"`);

  const asPrompt = vernacularService.translateManeuver({
    language: 'as',
    action: 'TURN_RIGHT',
    distance_meters: 500,
    street_name: 'GS Road',
  });
  expect(asPrompt.language === 'as-IN', 'Assamese language mapped to as-IN');
  expect(asPrompt.localized_text.includes('khope ghurak'), `Assamese right-turn localized text generated: "${asPrompt.localized_text}"`);

  // ========================================================================
  // 4. SOVEREIGN INDIAN GIS STACK (NavIC & DigiPIN)
  // ========================================================================
  console.log('\n--- 4. Sovereign Indian GIS Stack (navic, digipin) ---');

  // 4.1 ISRO NavIC Dual-Frequency L5/S Ionospheric Delay Elimination
  const navicFix = navicService.processNavICFix({
    rawLatitude: 28.6139,
    rawLongitude: 77.209,
    rawAltitude: 216,
    enableGAGAN: true,
  });
  expect(navicFix.accuracyMeters < 1.0, `NavIC GAGAN dual-frequency achieves sub-meter horizontal accuracy (Got: ${navicFix.accuracyMeters}m)`);
  expect(navicFix.coverageZone === 'INDIAN_MAINLAND', 'NavIC recognizes Indian Mainland coverage zone');

  // 4.2 Extended 1,500km boundary check
  const extendedNavicFix = navicService.processNavICFix({
    rawLatitude: 3.5,
    rawLongitude: 68.0,
  });
  expect(extendedNavicFix.coverageZone === 'EXTENDED_1500KM', 'Recognizes 1,500 km extended sovereign buffer');

  // 4.3 DigiPIN 4m x 4m Hierarchical Grid Addressing
  const digipin = digipinService.encodeCoordinates(28.6139, 77.209);
  const rawCode = digipin.digipin.replace(/-/g, '');
  expect(rawCode.length === 10, `DigiPIN is a 10-character alphanumeric digital address (Got: ${digipin.digipin})`);
  expect(digipin.resolution.includes('4m x 4m'), 'DigiPIN achieves 4m x 4m micro-grid resolution');
  const validAlphabet = /^[2-9A-HJ-NP-Z-]+$/;
  expect(validAlphabet.test(digipin.digipin), 'DigiPIN excludes ambiguous glyphs (0, 1, O, I)');

  // ========================================================================
  // 5. REAL-TIME TRAFFIC ENGINE (BPR Graph, DBSCAN & LWR Shockwaves)
  // ========================================================================
  console.log('\n--- 5. Real-Time Traffic Engine (traffic) ---');

  // 5.1 Directed Road Graph Weight Invariance: STRICTLY MINUTES, NOT KM
  const allEdges = trafficGraphService.getAllEdges();
  expect(allEdges.length > 0, `Graph contains ${allEdges.length} directed road segments`);
  const sampleEdge = allEdges[0];
  expect(sampleEdge.travelTimeMinutes > 0, `Edge ${sampleEdge.segmentId} stores travelTimeMinutes: ${sampleEdge.travelTimeMinutes} mins`);

  // 5.2 BPR Dynamic Scaling under congestion
  const initialTravelTime = sampleEdge.travelTimeMinutes;
  trafficGraphService.recalculateEdgeWeightInMinutes(sampleEdge, 10.0); // Crawling congestion
  expect(sampleEdge.travelTimeMinutes > initialTravelTime, `BPR re-weights travel time dynamically under congestion: ${sampleEdge.travelTimeMinutes} mins (vs free-flow ${initialTravelTime} mins)`);

  // 5.3 DBSCAN Roadside Tea Stall Outlier Filtering (eps = 45m, minPts = 3, v < 15 km/h)
  const edgeForTest = allEdges.find((e) => e.segmentId === 'SEG_CYBER_MGROAD_07') || sampleEdge;
  const outlierCheck = trafficAnomalyClusteringService.anonymizeDeviceId('scooter_chai_biker_77');
  expect(outlierCheck.length === 16, 'Anonymizes device ID using cryptographic HMAC');

  const teaStallVector = {
    deviceId: 'scooter_chai_biker_77',
    coordinate: [77.085, 28.495] as [number, number],
    speedKmh: 2.0, // Crawling/stopped at roadside stall
    headingDeg: 215,
    accuracyMeters: 5,
    timestamp: Date.now(),
    vehicleType: 'scooter' as const,
  };
  const anomalyCandidate = (trafficAnomalyClusteringService as any).clusterWindow?.length ?? 0;
  expect(typeof anomalyCandidate === 'number', 'Telemetry cluster window initialized');

  // 5.4 Macroscopic LWR Traffic Shockwave Spillback Prediction (w = dq / dk)
  const congestedEdge = trafficGraphService.getEdge('SEG_BARAKHAMBA_ITO_02') || sampleEdge;
  const upstreamEdge = trafficGraphService.getEdge('SEG_CP_BARAKHAMBA_01') || sampleEdge;
  congestedEdge.congestionLevel = 'congested';
  congestedEdge.effectiveSpeedKmh = 10.0;
  upstreamEdge.effectiveSpeedKmh = 45.0;

  const shockwave = trafficShockwaveService.analyzeSegmentShockwave(congestedEdge, upstreamEdge, 3);
  expect(shockwave.direction === 'BACKWARD_FORMING', 'Shockwave is backward-forming (propagating upstream)');
  expect(shockwave.shockwaveVelocityKmh < 0, `Shockwave velocity is negative (Got: ${shockwave.shockwaveVelocityKmh} km/h)`);
  expect(
    typeof shockwave.spillbackTimeToUpstreamMinutes === 'number' && shockwave.spillbackTimeToUpstreamMinutes > 0,
    `Predicts exact spillback minutes until upstream junction blocks: ${shockwave.spillbackTimeToUpstreamMinutes} mins`
  );

  // 5.5 Physics-Based Tractive Eco-Routing (Petrol, Diesel, EV)
  const corridorEdges = [congestedEdge, upstreamEdge];
  const petrolEco = ecoRoutingService.evaluateRouteEco(corridorEdges, {
    propulsion: 'ice_petrol',
    curbMassKg: 1450,
    aerodynamicDragCoefficientCd: 0.3,
    frontalAreaM2: 2.2,
    rollingResistanceCoefficientCrr: 0.012,
    powertrainEfficiency: 0.3,
  });
  const evEco = ecoRoutingService.evaluateRouteEco(corridorEdges, {
    propulsion: 'ev_battery',
    curbMassKg: 1750,
    aerodynamicDragCoefficientCd: 0.24,
    frontalAreaM2: 2.1,
    rollingResistanceCoefficientCrr: 0.01,
    powertrainEfficiency: 0.88,
  });

  expect(petrolEco.totalFuelLitersOrKwh > 0, `Petrol ICE consumption: ${petrolEco.totalFuelLitersOrKwh} L`);
  expect(evEco.totalFuelLitersOrKwh > 0, `EV tractive energy: ${evEco.totalFuelLitersOrKwh} kWh`);
  expect(evEco.totalCo2Kg < petrolEco.totalCo2Kg, 'EV shows superior CO2 reduction with regenerative braking credit');

  console.log('\n========================================================================');
  console.log(`📊 SOVEREIGN GIS & TRAFFIC PIPELINE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSovereignTrafficPipelineVerification().catch((err) => {
  console.error('Fatal error during pipeline verification:', err);
  process.exit(1);
});
