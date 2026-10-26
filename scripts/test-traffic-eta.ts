import { crowdsourcedTelemetryService } from '../src/modules/traffic/crowdsourced-telemetry.service';
import { trafficAnomalyClusteringService } from '../src/modules/traffic/traffic-anomaly-clustering.service';
import { trafficEtaService } from '../src/modules/traffic/traffic-eta.service';
import { trafficGraphService } from '../src/modules/traffic/traffic-graph.service';
import { trafficPredictionService } from '../src/modules/traffic/traffic-prediction.service';
import { TelemetryVelocityVector } from '../src/modules/traffic/traffic.types';

async function runTrafficVerificationTests() {
  console.log('===============================================================');
  console.log('🚀 REAL-TIME TRAFFIC & ETA ENGINE: VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Crowdsourced Telemetry & Differential Privacy Anonymization
  // -------------------------------------------------------------
  console.log('--- TEST 1: Crowdsourced Telemetry & Anonymization ---');
  const rawDeviceId = 'device_rider_9876543210';
  const anonId1 = trafficAnomalyClusteringService.anonymizeDeviceId(rawDeviceId);
  const anonId2 = trafficAnomalyClusteringService.anonymizeDeviceId(rawDeviceId);

  assert(anonId1 !== rawDeviceId, 'Device ID must be cryptographically hashed/salted');
  assert(anonId1 === anonId2, 'Same device ID must yield deterministic anonymized ID in current salt cycle');
  assert(anonId1.length === 16, 'Anonymized device ID should have standard 16-character length');

  // -------------------------------------------------------------
  // TEST 2: Edge Case False Positive Prevention:
  // "One scooter stopping at a roadside tea stall"
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Edge Case: Scooter at Roadside Tea Stall ---');
  const teaStallScooter: TelemetryVelocityVector = {
    deviceId: 'scooter_rajesh_99',
    coordinate: [77.0888, 28.4952], // DLF Cyber Hub corridor
    speedKmh: 2.0, // Crawling/stopped at roadside stall
    headingDeg: 215,
    accuracyMeters: 5,
    timestamp: Date.now(),
    vehicleType: 'scooter',
  };

  const outlierEvaluation = trafficEtaService.evaluateAnomalyCandidate(
    teaStallScooter,
    'SEG_CYBER_IFFCO_06'
  );

  console.log('Outlier Evaluation Result:', JSON.stringify(outlierEvaluation.details, null, 2));

  assert(outlierEvaluation.isOutlier === true, 'Single stopped scooter must be flagged as an outlier');
  assert(
    outlierEvaluation.anomalyType === 'TEA_STALL_PAUSE' ||
      outlierEvaluation.anomalyType === 'SINGLE_DEVICE_ROADSIDE_STOP',
    `Anomaly type must be roadside/tea stall stop (Got: ${outlierEvaluation.anomalyType})`
  );
  assert(
    outlierEvaluation.details.isExcludedFromAggregation === true,
    'Outlier must be excluded from segment speed aggregation'
  );

  // Ingest batch containing the tea stall scooter + 4 normal vehicles
  const normalVehicles: TelemetryVelocityVector[] = [
    {
      deviceId: 'car_fleet_01',
      coordinate: [77.0885, 28.4955],
      speedKmh: 48.0,
      headingDeg: 215,
      timestamp: Date.now(),
      vehicleType: 'car',
    },
    {
      deviceId: 'car_fleet_02',
      coordinate: [77.0875, 28.4935],
      speedKmh: 52.0,
      headingDeg: 215,
      timestamp: Date.now(),
      vehicleType: 'car',
    },
    {
      deviceId: 'bike_courier_01',
      coordinate: [77.0865, 28.4915],
      speedKmh: 46.0,
      headingDeg: 215,
      timestamp: Date.now(),
      vehicleType: 'motorcycle',
    },
    {
      deviceId: 'auto_rickshaw_01',
      coordinate: [77.0855, 28.4895],
      speedKmh: 42.0,
      headingDeg: 215,
      timestamp: Date.now(),
      vehicleType: 'auto_rickshaw',
    },
    teaStallScooter,
  ];

  const batchResult = await trafficEtaService.ingestCrowdsourcedTelemetry(normalVehicles);
  assert(batchResult.outliersFilteredCount >= 1, 'At least 1 outlier must be suppressed from batch');
  assert(
    batchResult.anomaliesDetected.some(
      (a) => a.anomalyType === 'TEA_STALL_PAUSE' || a.anomalyType === 'SINGLE_DEVICE_ROADSIDE_STOP'
    ),
    'Anomaly detection must identify tea stall pause'
  );

  // Verify that segment speed remains healthy (> 40 km/h) despite the stopped scooter
  const segmentAfterIngest = trafficGraphService.getEdge('SEG_CYBER_IFFCO_06');
  assert(
    segmentAfterIngest !== undefined && segmentAfterIngest.currentSpeedKmh > 35.0,
    `Segment speed must NOT drop to near-zero from 1 scooter at tea stall (Speed: ${segmentAfterIngest?.currentSpeedKmh} km/h)`
  );

  // -------------------------------------------------------------
  // TEST 3: Multi-Device Clustering: True Congestion Confirmation
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Multi-Device Clustering Quorum (True Jam) ---');
  const congestionPlatoon: TelemetryVelocityVector[] = [
    {
      deviceId: 'jam_car_1',
      coordinate: [77.238, 28.62665],
      speedKmh: 6.0,
      headingDeg: 78,
      timestamp: Date.now(),
      vehicleType: 'car',
    },
    {
      deviceId: 'jam_bus_2',
      coordinate: [77.239, 28.62689],
      speedKmh: 7.0,
      headingDeg: 78,
      timestamp: Date.now(),
      vehicleType: 'bus',
    },
    {
      deviceId: 'jam_truck_3',
      coordinate: [77.24, 28.62713],
      speedKmh: 5.5,
      headingDeg: 78,
      timestamp: Date.now(),
      vehicleType: 'truck',
    },
  ];

  const jamResult = await trafficEtaService.ingestCrowdsourcedTelemetry(congestionPlatoon);
  console.log('jamResult:', JSON.stringify(jamResult, null, 2));
  const confirmedCluster = jamResult.clusters.find((c) => c.isQuorumReached);

  assert(
    confirmedCluster !== undefined,
    'Cluster quorum (>= 3 independent devices) must confirm real congestion'
  );
  assert(
    confirmedCluster?.classification === 'CONFIRMED_CONGESTION',
    'Cluster classification must be CONFIRMED_CONGESTION'
  );

  // -------------------------------------------------------------
  // TEST 4: Traffic Prediction (Live + Historical Fusion)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Traffic Prediction Across 15-Minute Time Windows ---');
  const edgeToPredict = trafficGraphService.getEdge('SEG_CP_BARAKHAMBA_01')!;
  
  // 4a. Near-term live blended prediction (departure in 5 minutes)
  const nearTermDeparture = new Date(Date.now() + 5 * 60 * 1000);
  const liveBlendedPrediction = trafficPredictionService.predictSegmentSpeed(
    edgeToPredict,
    42.0, // Live speed
    6, // 6 active devices
    nearTermDeparture
  );

  console.log('Near-term Live Blended Prediction:', {
    timeWindow: liveBlendedPrediction.timeWindowLabel,
    predictedSpeed: liveBlendedPrediction.predictedSpeedKmh,
    effectiveSpeed: liveBlendedPrediction.effectiveSpeedKmh,
    congestionLevel: liveBlendedPrediction.congestionLevel,
    weightLiveUsed: liveBlendedPrediction.weightLiveUsed,
  });

  assert(
    liveBlendedPrediction.weightLiveUsed > 0.5,
    `Live telemetry weight must be strongly applied for near-term departure (Got weight: ${liveBlendedPrediction.weightLiveUsed})`
  );

  // 4b. Future historical forecast (Monday 09:15 AM rush hour)
  const morningPeakDate = new Date('2026-10-26T09:15:00'); // Monday 09:15 AM
  const futurePrediction = trafficPredictionService.predictSegmentSpeed(
    edgeToPredict,
    42.0, // Live speed from today
    6,
    morningPeakDate
  );

  console.log('Future Rush Hour Historical Prediction:', {
    timeWindow: futurePrediction.timeWindowLabel,
    predictedSpeed: futurePrediction.predictedSpeedKmh,
    effectiveSpeed: futurePrediction.effectiveSpeedKmh,
    congestionLevel: futurePrediction.congestionLevel,
    weightLiveUsed: futurePrediction.weightLiveUsed,
  });

  assert(
    futurePrediction.timeWindowLabel === '09:15-09:30',
    `Bucket label must match 15-min interval (Got: ${futurePrediction.timeWindowLabel})`
  );
  assert(
    futurePrediction.predictedSpeedKmh > 0 && futurePrediction.predictedSpeedKmh <= 60,
    'Predicted speed must fall within realistic bounds'
  );


  // -------------------------------------------------------------
  // TEST 5: Road Graph Weighting & ETA Calculation (Travel Time in MINUTES)
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Road Graph Weighting in MINUTES (not KM) ---');
  const allEdges = trafficGraphService.getAllEdges();
  const allNodes = trafficGraphService.getAllNodes();

  assert(allNodes.length >= 8, 'Graph must contain intersection nodes');
  assert(allEdges.length >= 8, 'Graph must contain directed road segments');

  // Verify that edge weights are in MINUTES
  for (const edge of allEdges) {
    assert(
      typeof edge.travelTimeMinutes === 'number' && edge.travelTimeMinutes > 0,
      `Edge ${edge.segmentId} must have travelTimeMinutes > 0 (Got: ${edge.travelTimeMinutes} mins)`
    );
  }

  // Calculate full route ETA
  const originConnaughtPlace: [number, number] = [77.2185, 28.6328];
  const destIffcoChowk: [number, number] = [77.0715, 28.4725];

  const etaResponse = await trafficEtaService.calculateRealtimeEta(
    originConnaughtPlace,
    destIffcoChowk,
    new Date()
  );

  console.log('ETA Calculation Output:', {
    totalDistanceKm: etaResponse.totalDistanceKm,
    totalEtaMinutes: etaResponse.totalEtaMinutes,
    totalDelayMinutes: etaResponse.totalDelayMinutes,
    overallCongestion: etaResponse.overallCongestionLevel,
    stepsCount: etaResponse.steps.length,
    intersectionsCrossed: etaResponse.intersectionsCrossed.length,
  });

  assert(
    etaResponse.totalEtaMinutes > 0,
    `Total ETA must be computed in MINUTES (Got: ${etaResponse.totalEtaMinutes} minutes)`
  );
  assert(
    etaResponse.totalDistanceKm > 10,
    `Total distance should be realistic for Delhi-NCR corridor (Got: ${etaResponse.totalDistanceKm} km)`
  );
  assert(
    etaResponse.steps.length >= 3,
    'Route must traverse multiple road segments'
  );
  assert(
    etaResponse.intersectionsCrossed.length >= 2,
    'Route must traverse intersection nodes with signal/turn delays'
  );
  assert(
    etaResponse.steps.every((s) => typeof s.travelTimeMinutes === 'number'),
    'Every route step must specify travelTimeMinutes'
  );

  console.log('\n===============================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTrafficVerificationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
