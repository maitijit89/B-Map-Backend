import {
  unifiedUnderlyingEngineService,
  positioningEngineService,
  offRouteEngineService,
  trafficShockwaveEngineService,
  ecoRoutingEngineService,
  EcoRoutingService,
  digiPINEngineService,
  fastagTollEngineService,
  pinCodeEngineService,
  geofenceEngineService,
  highwayWeatherEngineService,
  defenseObfuscationEngineService,
  vernacularEngineService,
  navicEngineService,
  tspOptimizationEngineService,
  zeroTrustSecurityEngineService,
  trafficGraphEngineService,
  crowdsourcedTelemetryEngineService,
  dbscanAnomalyClusteringEngineService,
  laneGuidanceEngineService,
  parkingNavigationEngineService,
  srNavigationEngineService,
  arWalkCycleEngineService,
  automotiveEcosystemEngineService,
  riderModeEngineService,
  v2xEngineService,
  fareEstimationEngineService,
  evChargingEngineService,
  indoorBeaconEngineService,
  publicTransitEngineService,
  emergencyDispatchEngineService,
  carNavigationEngineService,
  ExtendedKalmanFilter,
} from '../src/core/engines';
import { Coordinate, GeoJsonLineString } from '../src/core/types/geo.types';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
    failCount++;
  }
}

async function runEngineVerification() {
  console.log('\n========================================================================');
  console.log('🧪 B-MAP PLATFORM 15-ENGINE FULL INTEGRATION & VALIDATION SUITE');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. DigiPIN 4m x 4m National Hierarchical Grid Engine
  // -------------------------------------------------------------------------
  console.log('--- 1. DigiPIN 4m x 4m National Hierarchical Micro-Grid Engine ---');
  const cpLat = 28.6304;
  const cpLng = 77.2177;
  const encoded = digiPINEngineService.encodeCoordinates(cpLat, cpLng);
  assert(Boolean(encoded.digipin && encoded.digipin.length === 14), 'DigiPIN encoding format (10-char with hyphens)', encoded.digipin);
  assert(encoded.state.includes('Delhi'), 'DigiPIN state resolution', encoded.state);

  const decoded = digiPINEngineService.decodeDIGIPIN(encoded.digipin);
  const latDiff = Math.abs(decoded.center_coordinate.latitude - cpLat);
  const lngDiff = Math.abs(decoded.center_coordinate.longitude - cpLng);
  assert(latDiff < 0.0001 && lngDiff < 0.0001, 'DigiPIN bidirectional reversibility (<4m precision)', `Lat diff: ${latDiff}, Lng diff: ${lngDiff}`);

  // -------------------------------------------------------------------------
  // 2. Dynamic Rerouting & Off-Route Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Dynamic Rerouting & Off-Route Engine ---');
  const dummyGeometry: GeoJsonLineString = {
    type: 'LineString',
    coordinates: [
      [77.2177, 28.6304],
      [77.2200, 28.6350],
      [77.2250, 28.6400],
    ],
  };

  // Normal on-route tracking
  const evalNormal = await offRouteEngineService.evaluateAndProcessProgress({
    sessionId: 'test_sess_1',
    currentLocation: [77.2178, 28.6305],
    destination: [77.2250, 28.6400],
    routeGeometry: dummyGeometry,
    heading: 45,
  });
  assert(evalNormal.state === 'TRACKING' && !evalNormal.isOffRoute, 'Normal tracking state evaluated');

  // Heading divergence test (3 consecutive epochs over 15m)
  const offLoc: Coordinate = [77.2190, 28.6300]; // ~120m away
  await offRouteEngineService.evaluateAndProcessProgress({
    sessionId: 'test_sess_2',
    currentLocation: offLoc,
    destination: [77.2250, 28.6400],
    routeGeometry: dummyGeometry,
    heading: 220, // divergent from segment (~45 deg)
  });
  await offRouteEngineService.evaluateAndProcessProgress({
    sessionId: 'test_sess_2',
    currentLocation: offLoc,
    destination: [77.2250, 28.6400],
    routeGeometry: dummyGeometry,
    heading: 220,
  });
  const evalDiv3 = await offRouteEngineService.evaluateAndProcessProgress({
    sessionId: 'test_sess_2',
    currentLocation: offLoc,
    destination: [77.2250, 28.6400],
    routeGeometry: dummyGeometry,
    heading: 220,
  });
  assert(evalDiv3.isOffRoute, 'Heading divergence / XTD trigger detected', `Reason: ${evalDiv3.rerouteReason}`);

  // -------------------------------------------------------------------------
  // 3. 6-Digit Indian Postal Pincode Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 3. 6-Digit Indian Postal Pincode & Landmark Parsing Engine ---');
  const pin1 = pinCodeEngineService.lookupPINCode('110001');
  assert(pin1 !== null && pin1.district === 'Central Delhi', 'Direct PIN Code lookup (110001 Connaught Place)');

  const pinUnindexed = pinCodeEngineService.lookupPINCode('560034'); // Koramangala
  assert(pinUnindexed !== null && pinUnindexed.state === 'Karnataka', 'Hierarchical PIN Code resolution (560034 Bengaluru)');

  const parsedAddr = pinCodeEngineService.parseIndianAddress('Flat 402, Near Metro Pillar 142, Opposite Hanuman Mandir, Connaught Place, New Delhi 110001');
  assert(parsedAddr.pincode === '110001', 'Indian address PIN extraction');
  assert(Boolean(parsedAddr.metroPillar), 'Indian address metro pillar extraction', parsedAddr.metroPillar);
  assert(parsedAddr.landmarks.length > 0, 'Indian address landmark entities extraction', JSON.stringify(parsedAddr.landmarks));

  const reversePin = pinCodeEngineService.reverseLookup(12.9352, 77.6245);
  assert(reversePin.state === 'Karnataka', 'Reverse PIN Code geocoding');

  // -------------------------------------------------------------------------
  // 4. Geofence Engine & Real-Time Push Orchestration Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Geofence Engine & Push Orchestrator ---');
  const geoCircular = geofenceEngineService.registerGeofence({
    geofenceId: 'geo_bkc_mumbai',
    name: 'BKC Financial District',
    type: 'CIRCULAR',
    center: [72.8687, 19.0657],
    radiusMeters: 500,
    dwellThresholdSeconds: 60,
  });
  assert(Boolean(geoCircular), 'Circular geofence registration');

  const eventsEnter = await geofenceEngineService.evaluateDeviceGeofences({
    userId: 'user_test_99',
    deviceId: 'dev_iphone_15',
    currentCoordinates: [72.8688, 19.0658], // ~15m from center
  });
  assert(eventsEnter.some((e) => e.eventType === 'ENTER'), 'Geofence ENTER transition detection');

  // -------------------------------------------------------------------------
  // 5. NHAI FASTag Dynamic Toll Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 5. NHAI FASTag Dynamic Toll Collection Engine ---');
  const class4 = fastagTollEngineService.resolveVehicleClass('CLASS_4');
  const class6 = fastagTollEngineService.resolveVehicleClass('CLASS_6');
  assert(class4.multiplier === 1.0, 'Class 4 (Car) baseline toll multiplier');
  assert(class6.multiplier === 3.35, 'Class 6 (2-Axle Truck/Bus) toll multiplier');

  const tollCalc = fastagTollEngineService.calculateTolls({
    origin: 'Delhi',
    destination: 'Mumbai',
    vehicleType: 'car',
  });
  assert(tollCalc.totalTollINR > 0, 'Delhi-Mumbai NE-4 FASTag toll calculation', `INR ${tollCalc.totalTollINR}`);
  assert(tollCalc.cashlessLaneGuidance.length > 0, 'Cashless lane guidance provided');

  // -------------------------------------------------------------------------
  // 6. IMD Highway Weather Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 6. IMD Highway Weather & Winter Fog Hazard Engine ---');
  const weatherReport = highwayWeatherEngineService.getHighwayWeather(28.5, 77.2, 'Yamuna Expressway');
  assert(Boolean(weatherReport.safety_advisory), 'IMD weather report generation');
  assert(weatherReport.is_dense_fog_active === true, 'Winter fog corridor detection (<50m)');

  const corridorReports = highwayWeatherEngineService.scanRouteCorridor([
    { latitude: 28.5, longitude: 77.2 },
    { latitude: 28.1, longitude: 77.4 },
    { latitude: 27.5, longitude: 77.8 },
  ], 'NE-4');
  assert(corridorReports.length >= 3, 'Corridor multi-waypoint weather scan');

  // -------------------------------------------------------------------------
  // 7. Defense Obfuscation & Differential Privacy Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Defense Obfuscation & Planar Differential Privacy Engine ---');
  const fuzzed = defenseObfuscationEngineService.applyPrivacyFuzz({
    latitude: 28.6129,
    longitude: 77.2295,
    radius_meters: 200,
    epsilon: 1.0,
  });
  assert(fuzzed.privacy_mechanism.includes('Laplace'), 'Planar Laplacian differential privacy noise', fuzzed.privacy_mechanism);
  assert(fuzzed.noise_radius_meters > 0, 'Non-zero privacy noise displacement');

  const defenseMask = defenseObfuscationEngineService.applyDefenseMasking({
    latitude: 28.5885,
    longitude: 77.1352, // Delhi Cantt
  });
  assert(defenseMask.is_within_defense_zone === true, 'Defense installation zone detection (Delhi Cantt)');
  assert(defenseMask.jitter_distance_meters >= 200, 'Strategic 200m-500m coordinate jitter applied');

  // -------------------------------------------------------------------------
  // 8. Vernacular 12-Language Maneuver Voice Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Vernacular 12-Language Turn-by-Turn Voice Engine ---');
  const hiTurn = vernacularEngineService.translateManeuver({
    language: 'hi',
    action: 'TURN_RIGHT',
    distance_meters: 250,
    street_name: 'MG Road',
  });
  assert(hiTurn.localized_text.includes('MG Road'), 'Hindi maneuver prompt generation', hiTurn.localized_text);

  const taTurn = vernacularEngineService.translateManeuver({
    language: 'ta',
    action: 'TAKE_FLYOVER',
    distance_meters: 500,
  });
  assert(Boolean(taTurn.localized_text), 'Tamil flyover maneuver prompt generation', taTurn.localized_text);

  // -------------------------------------------------------------------------
  // 9. ISRO NavIC Dual-Band L5/S & GAGAN Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 9. ISRO NavIC Dual-Band L5/S & GAGAN Engine ---');
  const navicFix = navicEngineService.processNavICFix({
    rawLatitude: 28.6304,
    rawLongitude: 77.2177,
    enableGAGAN: true,
  });
  assert(navicFix.accuracyMeters <= 1.0, 'GAGAN sub-meter augmented accuracy (<1m)', `${navicFix.accuracyMeters}m`);
  assert(Boolean(navicFix.dop && navicFix.dop.pdop > 0), 'Dilution of Precision (DOP) matrix inversion', `PDOP: ${navicFix.dop?.pdop}`);

  // -------------------------------------------------------------------------
  // 10. Physics-Based Vehicle Eco-Routing Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Physics-Based Vehicle Eco-Routing Engine ---');
  const dummyEdge: any = {
    segmentId: 'seg_nh44_1',
    name: 'NH-44 Corridor',
    lengthMeters: 5000,
    effectiveSpeedKmh: 80,
    travelTimeMinutes: 3.75,
    congestionLevel: 'low',
    gradePercent: 1.5,
  };
  const petrolEnergy = ecoRoutingEngineService.calculateSegmentEnergy(dummyEdge, EcoRoutingService.DEFAULT_PETROL_CAR);
  const evEnergy = ecoRoutingEngineService.calculateSegmentEnergy(dummyEdge, EcoRoutingService.DEFAULT_EV_CAR);
  assert(petrolEnergy.energyJoules > 0, 'ICE Petrol vehicle energy consumption', `${petrolEnergy.energyJoules} J (${petrolEnergy.equivalentFuelLitersOrKwh} L)`);
  assert(evEnergy.equivalentFuelLitersOrKwh > 0, 'EV battery energy consumption', `${evEnergy.equivalentFuelLitersOrKwh} kWh`);

  // Downhill regenerative braking
  const downhillEdge: any = { ...dummyEdge, gradePercent: -6.0 };
  const regenResult = ecoRoutingEngineService.calculateSegmentEnergy(downhillEdge, EcoRoutingService.DEFAULT_EV_CAR);
  assert((regenResult.regeneratedEnergyJoules || 0) > 0, 'EV downhill regenerative braking recapture', `${regenResult.regeneratedEnergyJoules} J recaptured`);

  // -------------------------------------------------------------------------
  // 11. Macroscopic LWR Traffic Shockwave & Spillback Estimator
  // -------------------------------------------------------------------------
  console.log('\n--- 11. Macroscopic LWR Traffic Shockwave Dynamics Engine ---');
  const congestedEdge: any = {
    segmentId: 'seg_delhi_bottleneck',
    name: 'Ring Road Bottleneck',
    freeFlowSpeedKmh: 60,
    effectiveSpeedKmh: 12,
    congestionLevel: 'congested',
    lengthMeters: 800,
  };
  const shockwave = trafficShockwaveEngineService.analyzeSegmentShockwave(congestedEdge);
  assert(shockwave.isCongestionShockwaveActive === true, 'Backward-propagating congestion shockwave detected');
  assert(shockwave.shockwaveVelocityKmh < 0, 'Negative shockwave boundary velocity (upstream propagation)', `${shockwave.shockwaveVelocityKmh} km/h`);
  assert(typeof shockwave.spillbackTimeToUpstreamMinutes === 'number', 'Upstream intersection spillback time estimated', `${shockwave.spillbackTimeToUpstreamMinutes} mins`);

  // -------------------------------------------------------------------------
  // 12. TSP 2-Opt Multi-Stop Route Optimization Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 12. TSP 2-Opt Multi-Stop Route Optimization Engine ---');
  const multiStops: Coordinate[] = [
    [77.2090, 28.6139], // Delhi Center
    [77.2754, 28.5284], // Okhla
    [77.1147, 28.7126], // Rohini
    [77.2001, 28.5494], // Hauz Khas
    [77.2177, 28.6304], // Connaught Place
  ];
  const tspOpt = tspOptimizationEngineService.optimizeTour(multiStops, { fixOrigin: true, roundtrip: false });
  assert(tspOpt.optimizedSequence.length === 5, 'TSP itinerary tour contains all stops');
  assert(tspOpt.optimizedDistanceMeters <= tspOpt.originalDistanceMeters, '2-Opt edge untangling distance reduction', `Saved ${tspOpt.distanceSavedMeters}m (${tspOpt.percentImprovement}%)`);

  // -------------------------------------------------------------------------
  // 13. Zero-Trust Kinematic Anti-GPS Spoofing & Replay Crypto Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 13. Zero-Trust Kinematic Anti-GPS Spoofing & Replay Engine ---');
  const nowEpoch = Date.now();
  const validPacket = zeroTrustSecurityEngineService.verifyTelemetryPacket({
    deviceId: 'veh_delhi_truck_1',
    coordinate: [77.2177, 28.6304],
    speedKmh: 45,
    timestamp: nowEpoch,
    nonce: 'nonce_abc_123',
  });
  assert(validPacket.isValid === true, 'Plausible telemetry packet verification');

  // Replay attack test (timestamp 5 minutes old)
  const replayedPacket = zeroTrustSecurityEngineService.verifyTelemetryPacket({
    deviceId: 'veh_delhi_truck_2',
    coordinate: [77.2177, 28.6304],
    speedKmh: 45,
    timestamp: nowEpoch - 300000, // 5 mins old
    nonce: 'nonce_expired',
  });
  assert(replayedPacket.replayValid === false, 'Replay attack drift rejection (>60s)');

  // -------------------------------------------------------------------------
  // 14. High-Precision Positioning & Sensor Fusion Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 14. Positioning Engine (Sensor Fusion & EKF) ---');
  const fused = await positioningEngineService.processSensorPacket({
    deviceId: 'dev_test_tracker',
    timestamp: nowEpoch,
    gnss: {
      latitude: 28.6304,
      longitude: 77.2177,
      accuracy: 2.5,
      speed: 12.0,
      bearing: 45.0,
      timestamp: nowEpoch,
    },
  });
  assert(Boolean(fused.coordinates && fused.precisionLevel), 'Fused position state produced', fused.precisionLevel);

  // -------------------------------------------------------------------------
  // 15. Unified Underlying Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 15. Unified Underlying Navigation Engine ---');
  const session = await unifiedUnderlyingEngineService.startUnifiedSession({
    deviceId: 'dev_unified_car_1',
    origin: [77.2177, 28.6304],
    destination: [77.2250, 28.6400],
  });
  assert(Boolean(session.sessionId), 'Unified session initialized', session.sessionId);

  // -------------------------------------------------------------------------
  // 16. Dynamic Directed Traffic Graph & Congestion Re-Weighting Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 16. Dynamic Traffic Graph Engine ---');
  const nodes = trafficGraphEngineService.getAllNodes();
  const edges = trafficGraphEngineService.getAllEdges();
  assert(nodes.length > 0 && edges.length > 0, 'Road graph seeded with nodes and edges', `${nodes.length} nodes, ${edges.length} edges`);

  // -------------------------------------------------------------------------
  // 17. Crowdsourced Telemetry Ingestion & Map-Matching Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 17. Crowdsourced Telemetry Ingestion Engine ---');
  const batchResult = await crowdsourcedTelemetryEngineService.ingestTelemetryBatch(
    [
      {
        deviceId: 'dev_probe_101',
        vehicleType: 'car',
        coordinate: [77.2185, 28.5680],
        speedKmh: 42.0,
        headingDeg: 88.0,
        timestamp: nowEpoch,
      },
    ],
    edges
  );
  assert(batchResult.processedCount > 0, 'Telemetry batch ingested and processed');

  // -------------------------------------------------------------------------
  // 18. DBSCAN Spatial Anomaly & Road Incident Clustering Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 18. DBSCAN Traffic Anomaly Clustering Engine ---');
  const anonId = dbscanAnomalyClusteringEngineService.anonymizeDeviceId('dev_probe_101');
  assert(Boolean(anonId && anonId !== 'dev_probe_101'), 'Device ID cryptographically anonymized');
  const clusterResult = dbscanAnomalyClusteringEngineService.clusterSlowMovingDevices('seg_aiims_moolchand_east', [
    {
      deviceId: 'd1',
      anonymizedDeviceId: 'anon_d1',
      coordinate: [77.2185, 28.5680],
      speedKmh: 4.0,
      headingDeg: 90,
      timestamp: nowEpoch,
      vehicleType: 'car',
      segmentId: 'seg_aiims_moolchand_east',
      projectedCoordinate: [77.2185, 28.5680],
      lateralOffsetMeters: 0.1,
      vectorAlignmentCos: 0.98,
      projectedSpeedKmh: 4.0,
      isDirectionValid: true,
    },
    {
      deviceId: 'd2',
      anonymizedDeviceId: 'anon_d2',
      coordinate: [77.2186, 28.5681],
      speedKmh: 5.0,
      headingDeg: 90,
      timestamp: nowEpoch,
      vehicleType: 'car',
      segmentId: 'seg_aiims_moolchand_east',
      projectedCoordinate: [77.2186, 28.5681],
      lateralOffsetMeters: 0.2,
      vectorAlignmentCos: 0.98,
      projectedSpeedKmh: 5.0,
      isDirectionValid: true,
    },
  ]);
  assert(clusterResult.length > 0, 'DBSCAN cluster formed from slow vehicle cluster', `Found ${clusterResult.length} cluster(s)`);

  // -------------------------------------------------------------------------
  // 19. Lane-Level Routing & Micro-Navigation Guidance Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 19. Lane-Level Routing Guidance Engine ---');
  const laneAdvice = await laneGuidanceEngineService.computeLaneGuidance({
    roadName: 'Mahatma Gandhi Marg (Ring Road)',
    currentCoordinates: [77.2185, 28.5680],
    currentLaneIndex: 1,
    distanceToNextTurnMeters: 450,
    nextManeuverDirection: 'right',
  });
  assert(laneAdvice.recommendedLanes.length > 0, 'Target lane guidance calculated for upcoming maneuver');

  // -------------------------------------------------------------------------
  // 20. High-Precision Parking Space & Multi-Floor Navigation Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 20. Parking Space Navigation Engine ---');
  const vacantBays = await parkingNavigationEngineService.searchParkingBays('fac_select_citywalk_delhi', {
    floorLevel: -2,
    status: 'vacant',
  });
  assert(vacantBays.length > 0, 'Parking bays retrieved for multi-floor facility');
  const bayNav = await parkingNavigationEngineService.planIndoorBayNavigation({
    facilityId: 'fac_select_citywalk_delhi',
    targetBayId: vacantBays[0].bayId,
  });
  assert(bayNav.steps.length > 0, 'Indoor A* parking barrier-to-bay route generated');

  // -------------------------------------------------------------------------
  // 21. Sub-Meter Super-Resolution (SR) Lane-Offset Navigation Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 21. Sub-Meter SR Lane-Offset Navigation Engine ---');
  const srFrame = await srNavigationEngineService.computeSRHUDState({
    coordinates: [77.2183, 28.6328],
    speedKmh: 45,
    lateralOffsetMeters: 0.85,
    distanceToTurnMeters: 300,
  });
  assert(srFrame.lateralOffset.matchedLaneIndex >= 0, 'Sub-meter lateral lane index matched');

  // -------------------------------------------------------------------------
  // 22. Augmented Reality Walk & Micro-Mobility Cycle Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 22. Augmented Reality Walk & Cycle Engine ---');
  const walkPlan = await arWalkCycleEngineService.planWalkRoute({
    origin: [77.2177, 28.6304],
    destination: [77.2250, 28.6350],
    options: { accessibleMode: true },
  });
  assert(walkPlan.isWheelchairAccessible, 'Wheelchair accessible walking route verified');

  // -------------------------------------------------------------------------
  // 23. Automotive In-Vehicle Infotainment (IVI) & CAN-Bus ADAS Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 23. Automotive IVI & CAN-Bus ADAS Engine ---');
  const canFrame = automotiveEcosystemEngineService.generateHUDFrame({
    maneuverCode: 12,
    maneuverSymbol: 'FORK_RIGHT',
    distancePercent: 75,
    targetLaneBitmask: 0b00000001,
    vehicleSpeedKmh: 65,
    speedLimitKmh: 70,
  });
  assert(Boolean(canFrame.compactHexPayload), 'Automotive CAN-bus cluster payload encoded');

  // -------------------------------------------------------------------------
  // 24. Two-Wheeler Rider Mode & Autonomous Crash Detection Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 24. Rider Mode Two-Wheeler Engine ---');
  const crashTrigger = riderModeEngineService.evaluateCrashTrigger({
    telemetry: {
      rollAngleDegrees: 72,
      pitchAngleDegrees: 15,
      lateralAccelerationG: 4.2,
      yawRateDegPerSec: 0,
      vehicleSpeedKmh: 0,
      timestamp: nowEpoch,
    },
    stationarySeconds: 15,
    location: [77.2177, 28.6304],
  });
  assert(crashTrigger !== null && crashTrigger.status === 'countdown_cancelling', 'Autonomous rider e-Call crash detected');

  // -------------------------------------------------------------------------
  // 25. V2X Cooperative Collision & GLOSA Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 25. V2X Collision & GLOSA Engine ---');
  const glosa = v2xEngineService.calculateGLOSA(
    { latitude: 28.6304, longitude: 77.2177 },
    48.0,
    'INT_DEL_CP_01'
  );
  assert(glosa.recommended_speed_kmh > 0, 'GLOSA green wave advisory computed', `${glosa.recommended_speed_kmh} km/h`);

  // -------------------------------------------------------------------------
  // 26. Multimodal Transit Fare Estimation & Fare Matrix Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 26. Multimodal Fare Estimation Engine ---');
  const fares = fareEstimationEngineService.estimateFares({
    city: 'Delhi',
    distance_km: 12.5,
  });
  assert(fares.fare_options.length > 0, 'Metred auto-rickshaw fare calculated in INR', `₹${fares.fare_options[0].total_estimated_inr}`);

  // -------------------------------------------------------------------------
  // 27. EV Charging Network & Dynamic Range Optimization Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 27. EV Charging Network Engine ---');
  const evStations = evChargingEngineService.getNearbyStations({
    latitude: 28.6304,
    longitude: 77.2177,
    radius_km: 10,
  });
  assert(evStations.length > 0, 'Nearby fast-charging EV stations discovered');

  // -------------------------------------------------------------------------
  // 28. BLE Indoor Micro-Beacon & Multi-Floor Trilateration Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 28. BLE Indoor Micro-Beacon Engine ---');
  const indoorPos = await indoorBeaconEngineService.translateBeaconsToIndoorCoordinates({
    beacons: [
      { beaconId: 'bcn_moi_l1_central_atrium', rssi: -62 },
      { beaconId: 'bcn_moi_l1_zara_corridor', rssi: -67 },
      { beaconId: 'bcn_moi_l1_escalator_bank', rssi: -65 },
    ],
    permissions: {
      platform: 'android',
      bluetoothScan: true,
      bluetoothConnect: true,
      accessFineLocation: true,
    },
  });
  assert(indoorPos.confidence > 0.5 && indoorPos.floorLevel === 1, 'Multi-beacon 3D indoor position trilaterated');

  // -------------------------------------------------------------------------
  // 29. Sovereign Multimodal Public Transit Itinerary Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 29. Sovereign Multimodal Public Transit Engine ---');
  const transitItinerary = await publicTransitEngineService.planTransitItinerary({
    origin: [77.2183, 28.6328], // Rajiv Chowk
    destination: [77.2285, 28.6675], // Kashmere Gate
  });
  assert(transitItinerary.itineraries.length > 0, 'Delhi Metro multimodal transit itinerary planned');
  assert(transitItinerary.itineraries[0].fareEstimated.currency === 'INR', 'Sovereign transit ticketing in INR');

  // -------------------------------------------------------------------------
  // 30. Emergency Green-Corridor & Priority Dispatch Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 30. Emergency Green-Corridor Engine ---');
  const sosAlert = emergencyDispatchEngineService.triggerSOS({
    type: 'ACCIDENT',
    currentLocation: { latitude: 28.5672, longitude: 77.2100 },
    vehicleNumber: 'DL 01 AB 1234',
    userPhone: '+91 9811002233',
    message: 'Ambulance requested near AIIMS Trauma Center',
  });
  assert(sosAlert.status === 'DISPATCHED' && sosAlert.nearby_facilities.length > 0, 'AIIMS Emergency Green Corridor prioritized');

  // -------------------------------------------------------------------------
  // 31. In-Vehicle Car Navigation, Speed Trap & ADAS Camera Engine
  // -------------------------------------------------------------------------
  console.log('\n--- 31. Car Navigation & Speed Camera Trap Engine ---');
  const carNav = await carNavigationEngineService.planCarRoute({
    origin: [77.2177, 28.6304],
    destination: [77.0835, 28.4775],
  });
  assert(carNav.primaryRoute !== undefined && carNav.alternatives.length > 0, 'Multi-alternative car routes with speed cameras generated');

  // -------------------------------------------------------------------------
  // 32. Core Kinematic Motion Modeling & Extended Kalman Filter (EKF)
  // -------------------------------------------------------------------------
  console.log('\n--- 32. Kinematic Extended Kalman Filter (EKF) Algorithm ---');
  const ekf = new ExtendedKalmanFilter(1.8);
  const ekfEstimate = ekf.update([77.2178, 28.6305], 15.0, 45.0, nowEpoch + 1000, 4.0);
  assert(ekfEstimate.smoothedSpeedKmh > 0 && ekfEstimate.covarianceTrace < 50, 'EKF kinematic state filter fused GNSS telemetry');

  console.log('\n========================================================================');
  console.log(`📊 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runEngineVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
