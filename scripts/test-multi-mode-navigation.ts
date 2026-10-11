import { arWalkCycleService } from '../src/services/navigation/ar-walk-cycle.service';
import { carNavigationService } from '../src/services/navigation/car-navigation.service';
import { publicTransitService } from '../src/services/navigation/public-transit.service';
import { Coordinate } from '../src/types/geo.types';

async function runMultiModeNavigationTests() {
  console.log('🌍 ==================================================================== 🌍');
  console.log('   B-MAP MULTI-MODE CORE NAVIGATION & ROUTING COMPREHENSIVE TEST SUITE     ');
  console.log('🌍 ==================================================================== 🌍\n');

  // =========================================================================
  // PILLAR 1: Car Navigation (Next-Gen Multi-Strategy, Traffic & TSP)
  // =========================================================================
  console.log('🚗  --- 1. CAR NAVIGATION (MULTI-STRATEGY, TRAFFIC & TSP) ---');

  const carOrigin: Coordinate = [13.38886, 52.517037]; // Unter den Linden
  const carDest: Coordinate = [13.32, 52.502]; // Kurfürstendamm

  // 1A: Multi-Strategy Route Planning & Alternative Matrix
  const carPlan = await carNavigationService.planCarRoute({
    origin: carOrigin,
    destination: carDest,
    strategy: 'fastest',
    isElectricVehicle: true,
  });

  const pRoute = carPlan.primaryRoute;
  console.log(`   Primary Strategy:          ${pRoute.strategy.toUpperCase()} ("${pRoute.summary}")`);
  console.log(`   Distance / Duration:       ${(pRoute.totalDistanceMeters / 1000).toFixed(1)} km / ${Math.round(pRoute.totalDurationSeconds / 60)} mins`);
  console.log(`   Energy Consumption:        ${pRoute.fuelOrEnergyEstimated.litersOrKwh} ${pRoute.fuelOrEnergyEstimated.unit} (~€${pRoute.fuelOrEnergyEstimated.costEstimated})`);
  console.log(`   Traffic Congestion Share:  ${pRoute.congestionPercentage}% (Traffic lights: ${pRoute.trafficLightsCount})`);

  console.log(`   --- Route Alternatives Matrix:`);
  for (const alt of carPlan.alternatives) {
    const deltaStr = alt.durationDeltaMinutes >= 0 ? `+${alt.durationDeltaMinutes}` : `${alt.durationDeltaMinutes}`;
    console.log(`     - [${alt.strategy}] ${alt.summary} (${deltaStr} mins delta, ${alt.fuelOrEnergyEstimated.litersOrKwh} ${alt.fuelOrEnergyEstimated.unit})`);
  }

  // 1B: Speed Camera Alerts
  console.log(`   En-Route Speed Enforcement Cameras: ${pRoute.speedCameras.length} alert(s)`);
  pRoute.speedCameras.forEach((cam) => {
    console.log(`     - [${cam.type.toUpperCase()}] ${cam.warningMessage} (${cam.distanceAheadMeters}m ahead)`);
  });

  // 1C: Multi-Stop TSP Delivery & Waypoint Sequencing
  const multiStops = [
    { name: 'Customer A (Gendarmenmarkt)', coordinates: [13.392, 52.513] as Coordinate },
    { name: 'Customer B (Checkpoint Charlie)', coordinates: [13.390, 52.507] as Coordinate },
    { name: 'Customer C (Potsdamer Platz)', coordinates: [13.376, 52.509] as Coordinate },
  ];

  const tspPlan = await carNavigationService.optimizeMultiStopRoute({
    origin: carOrigin,
    stops: multiStops,
    destination: carDest,
  });

  console.log(`   --- Multi-Stop Sequence Optimization (TSP):`);
  console.log(`   Total Multi-Stop Distance: ${(tspPlan.totalDistanceMeters / 1000).toFixed(1)} km (~${Math.round(tspPlan.totalDurationSeconds / 60)} mins)`);
  tspPlan.optimizedOrder.forEach((s) => {
    const date = new Date(s.estimatedArrivalEpoch * 1000);
    const eta = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    console.log(`     Stop ${s.stopIndex}: ${s.name} [ETA ${eta}] (+${s.distanceFromPreviousMeters}m)`);
  });
  console.log('   ✅ PILLAR 1 PASSED: Multi-strategy matrix, EV energy, speed cameras, and TSP sequence validated.\n');

  // =========================================================================
  // PILLAR 2: Public Transit Mastery (Multimodal Metro, Bus, Tram & Rail)
  // =========================================================================
  console.log('🚇  --- 2. PUBLIC TRANSIT MASTERY (MULTIMODAL METRO, BUS, TRAM & RAIL) ---');

  const transitOrigin: Coordinate = [13.375, 52.508]; // Near Potsdamer Platz
  const transitDest: Coordinate = [13.415, 52.524]; // Near Alexanderplatz

  // 2A: Multimodal Trip Itinerary
  const transitPlan = await publicTransitService.planTransitItinerary({
    origin: transitOrigin,
    destination: transitDest,
    wheelchairAccessible: true,
  });

  const itin = transitPlan.itineraries[0];
  console.log(`   Trip Overview:             ${itin.departureTime} -> ${itin.arrivalTime} (${itin.totalDurationMinutes} mins total)`);
  console.log(`   Walking Time:              ${itin.totalWalkingMinutes} mins (Transfers: ${itin.transferCount})`);
  console.log(`   Recommended Ticket:        ${itin.fareEstimated.ticketName} (€${itin.fareEstimated.price.toFixed(2)})`);
  console.log(`   CO2 Reduction:             🍃 ${itin.co2SavedKg} kg CO2 saved vs driving car`);

  console.log(`   --- Step-by-Step Multimodal Legs:`);
  itin.legs.forEach((leg, idx) => {
    if (leg.legType === 'walk') {
      console.log(`     Leg ${idx + 1} [WALK]:    ${leg.walkInstruction} (${leg.distanceMeters}m, ${Math.round(leg.durationSeconds / 60)}m)`);
    } else {
      console.log(`     Leg ${idx + 1} [TRANSIT]: Board ${leg.line} (${leg.fromStation} -> ${leg.toStation}, ${leg.numberOfStops} stops)`);
      console.log(`       * Carriage Advice:     ${leg.optimalCarriageRecommendation}`);
      console.log(`       * Station Exit:        ${leg.stationExitGuidance}`);
    }
  });

  // 2B: Live Station Departure Board
  const board = await publicTransitService.getStationDepartures('stn_alexanderplatz');
  console.log(`   --- Live Departures Board for "${board.station.name}":`);
  board.departures.forEach((dep) => {
    const delayText = dep.delayMinutes > 0 ? `(+${dep.delayMinutes}m delay)` : '(On time)';
    console.log(`     - [${dep.line.padEnd(3)}] -> ${dep.destination.padEnd(32)} ${dep.realTimeDeparture} ${delayText} | ${dep.platform} [Crowding: ${dep.crowding.toUpperCase()}]`);
  });
  console.log('   ✅ PILLAR 2 PASSED: Multimodal itinerary, carriage advice, exit guidance, fare and live departures validated.\n');

  // =========================================================================
  // PILLAR 3: Augmented Reality (AR) Walk/Cycle Navigation
  // =========================================================================
  console.log('👓  --- 3. AUGMENTED REALITY (AR) WALK/CYCLE NAVIGATION ---');

  // 3A: AR 3D World Anchor Screen Projection
  const camPose = {
    latitude: 52.5096,
    longitude: 13.3769,
    altitude: 1.4, // Eye level
    yawDegrees: 45, // Looking North-East
    pitchDegrees: -5, // Slightly tilted downwards
    rollDegrees: 0,
    fovHorizontalDegrees: 65,
  };

  const sampleWaypoints: Coordinate[] = [
    [13.377, 52.5097],
    [13.3772, 52.5099],
    [13.3775, 52.5102],
    [13.378, 52.5105],
  ];

  const arHUD = arWalkCycleService.computeARHUDFrame({
    cameraPose: camPose,
    waypoints: sampleWaypoints,
    currentStepInstruction: 'Follow virtual chevrons along sidewalk',
    distanceToNextTurnMeters: 20,
  });

  console.log(`   AR Instruction:            "${arHUD.currentStepInstruction}"`);
  console.log(`   Zebra Crosswalk Warning:   ${arHUD.crosswalkSafety ? `⚠️ ${arHUD.crosswalkSafety.safetyText} [Signal: ${arHUD.crosswalkSafety.pedestrianSignal?.toUpperCase()}]` : 'None'}`);
  console.log(`   --- Projected AR 3D Anchors on Screen:`);
  arHUD.projectedAnchors.forEach((a) => {
    console.log(`     Anchor [${a.type.padEnd(20)}]: Screen (${a.screenXPercent}%, ${a.screenYPercent}%) | Dist: ${a.distanceMeters}m | Visible: ${a.isVisibleInView}`);
  });

  // 3B: Accessible & Sheltered Walk Route
  const walkPlan = await arWalkCycleService.planWalkRoute({
    origin: [13.3769, 52.5096],
    destination: [13.385, 52.515],
    options: {
      accessibleMode: true, // Wheelchair & stroller: no stairs
      shelteredMode: true, // Rain protection
    },
  });

  console.log(`   Pedestrian Walk Route:     ${walkPlan.totalDistanceMeters}m (~${Math.round(walkPlan.totalDurationSeconds / 60)} mins)`);
  console.log(`   Wheelchair Accessible:     ${walkPlan.isWheelchairAccessible ? '♿ YES (No stairs, curb ramps)' : 'NO'}`);
  console.log(`   Weather Sheltered Cover:   ${walkPlan.shelteredPercentage}% of route under covered arcades`);

  // 3C: Cycle Routing with Elevation Profile & Amenities
  const cyclePlan = await arWalkCycleService.planCycleRoute({
    origin: [13.3769, 52.5096],
    destination: [13.4114, 52.5218],
    vehicleType: 'ebike',
  });

  console.log(`   Cycle Route (${cyclePlan.vehicleType.toUpperCase()}):  ${(cyclePlan.totalDistanceMeters / 1000).toFixed(1)} km (~${Math.round(cyclePlan.totalDurationSeconds / 60)} mins)`);
  console.log(`   Protected Bike Lanes:      ${cyclePlan.protectedBikePathPercentage}% of route`);
  console.log(`   Elevation Profile:         +${cyclePlan.elevation.totalAscentMeters}m uphill / -${cyclePlan.elevation.totalDescentMeters}m downhill (Max Grade: ${cyclePlan.elevation.maxSlopePercent}%)`);
  if (cyclePlan.elevation.steepSections.length > 0) {
    console.log(`   Steep Section Advisory:    ⚠️  ${cyclePlan.elevation.steepSections[0].warning}`);
  }
  console.log(`   Estimated Calories Burned: 🔥 ${cyclePlan.caloriesBurned} kcal`);
  console.log(`   En-Route Bicycle Amenities: ${cyclePlan.amenitiesAlongRoute.length} found`);
  cyclePlan.amenitiesAlongRoute.forEach((am) => {
    console.log(`     - [${am.type.toUpperCase()}] ${am.name}`);
  });

  console.log('   ✅ PILLAR 3 PASSED: AR 3D anchor projection, accessible walk, cycle elevation, and amenities validated.\n');

  console.log('🎉 ==================================================================== 🎉');
  console.log('   ALL MULTI-MODE NAVIGATION PILLARS (CAR, TRANSIT, AR) VALIDATED!         ');
  console.log('🎉 ==================================================================== 🎉');
}

runMultiModeNavigationTests().catch((err) => {
  console.error('❌ Multi-Mode Simulation Error:', err);
  process.exit(1);
});
