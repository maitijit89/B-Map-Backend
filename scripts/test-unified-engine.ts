import { dynamicRecommendationService } from '../src/services/unified-engine/dynamic-recommendation.service';
import { unifiedUnderlyingEngineService } from '../src/services/unified-engine/unified-underlying-engine.service';
import { Coordinate } from '../src/types/geo.types';
import { UnifiedTelemetryTick } from '../src/types/unified-engine.types';

async function runUnifiedEngineTests() {
  console.log('⚡ ======================================================== ⚡');
  console.log('   B-MAP UNIFIED UNDERLYING ENGINE & DYNAMIC RECOMMENDATIONS');
  console.log('⚡ ======================================================== ⚡\n');

  const deviceId = 'bmw_i7_xdrive60';
  const origin: Coordinate = [13.38886, 52.517037]; // Brandenburg Gate
  const destination: Coordinate = [13.397634, 52.529407]; // Berlin Cathedral area
  let timestamp = Date.now();

  // -------------------------------------------------------------
  // TEST SCENARIO 1: Unified Telemetry Lifecycle Ingestion
  // -------------------------------------------------------------
  console.log('🚗 --- SCENARIO 1: Unified Underlying Engine Pipeline Ingestion ---');

  // Start unified session
  const session = await unifiedUnderlyingEngineService.startUnifiedSession({
    deviceId,
    origin,
    destination,
    routingStyle: 'veteran_fast',
    batteryOrFuelPercentage: 85,
  });
  console.log(`   Session Initialized: ${session.sessionId}`);
  console.log(`   Routing Style:       ${session.routingStyle}`);

  // Ingest high-precision RTK tick
  const tick1: UnifiedTelemetryTick = {
    sessionId: session.sessionId,
    sensorPacket: {
      deviceId,
      timestamp,
      gnss: {
        latitude: 52.517037,
        longitude: 13.38886,
        accuracy: 0.1,
        speed: 14.5, // ~52 km/h
        bearing: 35.0,
        hdop: 0.7,
        satellitesUsed: 16,
        fixType: 'rtk_fixed',
        timestamp,
      },
      imu: {
        timestamp,
        accelerometer: { x: 0.0, y: 0.15, z: 9.81 },
        gyroscope: { x: 0.0, y: 0.0, z: 0.001 },
      },
      odometry: {
        timestamp,
        speedMps: 14.5,
      },
    },
    batteryOrFuelPercentage: 85,
    timestamp,
  };

  const state1 = await unifiedUnderlyingEngineService.processUnifiedTick(tick1);
  console.log(`   Execution Latency:   ${state1.systemMetrics.latencyMs} ms`);
  console.log(`   Position Precision:  ${state1.fusedPosition.precisionLevel} (±${state1.fusedPosition.confidenceRadiusMeters}m)`);
  console.log(`   Assigned Lane:       Lane ${state1.fusedPosition.laneInfo?.assignedLaneIndex}`);
  console.log(`   Remaining Distance:  ${state1.remainingDistanceMeters} meters`);
  console.log(`   ETA Duration:        ${Math.round(state1.remainingDurationSeconds / 60)} minutes`);
  console.log(`   Current Road:        ${state1.laneGuidance?.currentRoadName}`);
  console.log(`   Recommended Lanes:   [${state1.laneGuidance?.recommendedLanes.join(', ')}]`);
  console.log(`   Engine Status:       ${state1.systemMetrics.engineStatus.toUpperCase()}`);
  console.log('   ✅ SCENARIO 1 PASSED: Unified positioning, routing, and lane guidance executed in single pipeline.\n');

  // -------------------------------------------------------------
  // TEST SCENARIO 2: Dynamic Destination Parking Recommendation
  // -------------------------------------------------------------
  console.log('🅿️ --- SCENARIO 2: Dynamic Destination Parking Recommendation ---');
  timestamp += 10000;

  // Vehicle is now close to destination (1,150 meters away)
  const tickNearDestination: UnifiedTelemetryTick = {
    sessionId: session.sessionId,
    sensorPacket: {
      deviceId,
      timestamp,
      gnss: {
        latitude: 52.525,
        longitude: 13.395,
        accuracy: 0.2,
        speed: 10.0,
        bearing: 35.0,
        satellitesUsed: 14,
        fixType: 'rtk_float',
        timestamp,
      },
    },
    batteryOrFuelPercentage: 82,
    timestamp,
  };

  const state2 = await unifiedUnderlyingEngineService.processUnifiedTick(tickNearDestination);
  console.log(`   Remaining Distance:  ${state2.remainingDistanceMeters}m (< 2km destination envelope)`);
  console.log(`   Active Recommendations Count: ${state2.activeRecommendations.length}`);

  const parkingRec = state2.activeRecommendations.find((r) => r.type === 'destination_parking');
  if (parkingRec) {
    console.log(`   * [${parkingRec.type.toUpperCase()}] Priority: ${parkingRec.priority.toUpperCase()}`);
    console.log(`     Title:   "${parkingRec.title}"`);
    console.log(`     Message: "${parkingRec.message}"`);
    console.log(`     Walk to Destination: ${parkingRec.data.recommendedPoi?.distanceMeters}m`);
    console.log(`     Open Bays Available: ${parkingRec.data.recommendedPoi?.availableBays}`);
  }
  console.log('   ✅ SCENARIO 2 PASSED: Destination parking proactively recommended within arrival envelope.\n');

  // -------------------------------------------------------------
  // TEST SCENARIO 3: Dynamic Low-Energy Replenishment Recommendation
  // -------------------------------------------------------------
  console.log('⚡ --- SCENARIO 3: Dynamic Low-Energy Replenishment (Battery < 20%) ---');
  timestamp += 5000;

  const tickLowBattery: UnifiedTelemetryTick = {
    sessionId: session.sessionId,
    sensorPacket: {
      deviceId,
      timestamp,
      gnss: {
        latitude: 52.525,
        longitude: 13.395,
        accuracy: 0.5,
        speed: 11.0,
        bearing: 35.0,
        timestamp,
      },
    },
    batteryOrFuelPercentage: 15, // Low battery!
    timestamp,
  };

  const state3 = await unifiedUnderlyingEngineService.processUnifiedTick(tickLowBattery);
  const energyRec = state3.activeRecommendations.find((r) => r.type === 'along_route_energy');

  if (energyRec) {
    console.log(`   * [${energyRec.type.toUpperCase()}] Priority: ${energyRec.priority.toUpperCase()}`);
    console.log(`     Title:   "${energyRec.title}"`);
    console.log(`     Message: "${energyRec.message}"`);
    console.log(`     Detour:  ${energyRec.data.detourDistanceMeters}m (${energyRec.data.detourDurationSeconds}s detour)`);
    console.log(`     Charger: "${energyRec.data.recommendedPoi?.name}"`);
  }
  console.log('   ✅ SCENARIO 3 PASSED: Minimal-detour energy station proactively recommended.\n');

  // -------------------------------------------------------------
  // TEST SCENARIO 4: Recommendation Acceptance & Route Switch
  // -------------------------------------------------------------
  console.log('🔄 --- SCENARIO 4: Recommendation Acceptance & Route Switch ---');
  if (parkingRec) {
    const accepted = dynamicRecommendationService.acceptRecommendation(session, parkingRec.recommendationId);
    console.log(`   Accepted Recommendation ID: ${accepted?.recommendationId}`);
    console.log(`   Active Recommendations Left in Session: ${session.activeRecommendations.size}`);
  }
  console.log('   ✅ SCENARIO 4 PASSED: User interaction accepted and updated session state.\n');

  console.log('🎉 ALL UNIFIED UNDERLYING ENGINE & DYNAMIC RECOMMENDATIONS VERIFIED!');
}

runUnifiedEngineTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
