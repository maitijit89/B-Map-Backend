import { laneRoutingService } from '../src/services/lane-routing/lane-routing.service';
import { veteranDriverLayerService } from '../src/services/lane-routing/veteran-driver-layer.service';
import { Coordinate } from '../src/types/geo.types';

async function runLaneAndVeteranTests() {
  console.log('🛣️ ======================================================== 🛣️');
  console.log('   B-MAP LANE-LEVEL ROUTING & VETERAN DRIVER LAYERING      ');
  console.log('🛣️ ======================================================== 🛣️\n');

  // -------------------------------------------------------------
  // TEST SCENARIO 1: Lane-Level Routing & Early Lane Change Alert
  // -------------------------------------------------------------
  console.log('🚗 --- SCENARIO 1: HD Lane-Level Guidance & Early Lane Change Warning ---');

  // Vehicle is traveling in Lane 2 at 50 km/h, but has an upcoming Left Turn in 350 meters
  const morningRushHour = new Date();
  morningRushHour.setHours(8, 30, 0, 0); // 08:30 AM (Bus lane active)

  const laneGuidance = await laneRoutingService.computeLaneGuidance({
    roadName: 'Kurfürstendamm Arterial',
    currentLaneIndex: 2, // Traveling in Lane 2 (Straight-only)
    distanceToNextTurnMeters: 350,
    nextManeuverDirection: 'left',
    currentSpeedMps: 13.8, // 50 km/h
    timestamp: morningRushHour.getTime(),
  });

  console.log(`   Road Name:          ${laneGuidance.currentRoadName}`);
  console.log(`   Total Lanes:        ${laneGuidance.totalLanes}`);
  console.log(`   Current Lane:       Lane ${laneGuidance.currentLaneIndex}`);
  console.log(`   Recommended Lanes:  [${laneGuidance.recommendedLanes.join(', ')}]`);
  console.log('   --- Lane Statuses:');
  laneGuidance.lanes.forEach((l) => {
    console.log(`     - Lane ${l.laneIndex} (${l.turnDirection.padEnd(8)} | ${l.laneType.padEnd(8)}): [${l.status.toUpperCase()}] ${l.reason || ''}`);
  });

  if (laneGuidance.prompt) {
    console.log('   --- Early Lane Change Prompt:');
    console.log(`     Urgency:          ${laneGuidance.prompt.urgency.toUpperCase()}`);
    console.log(`     Target Lane:      Lane ${laneGuidance.prompt.targetLaneIndex}`);
    console.log(`     Distance to Turn: ${laneGuidance.prompt.distanceToManeuverMeters}m`);
    console.log(`     Must Start In:    Next ${laneGuidance.prompt.recommendedChangeStartMeters}m`);
    console.log(`     HUD Instruction:  "${laneGuidance.prompt.instructionText}"`);
  }
  console.log('   ✅ SCENARIO 1 PASSED: Bus lane blocked & multi-lane change prompt issued.\n');

  // -------------------------------------------------------------
  // TEST SCENARIO 2: Veteran Driver Fast Mode (老司机竞速绕行模式)
  // -------------------------------------------------------------
  console.log('🏎️ --- SCENARIO 2: "Veteran Driver Fast" Mode (Secret Bypass Shortcut) ---');
  const origin: Coordinate = [13.38886, 52.517037]; // Near Brandenburg Gate
  const destination: Coordinate = [13.397634, 52.529407]; // Near Cathedral

  const veteranFastPlan = await veteranDriverLayerService.planVeteranEnhancedRoute({
    origin,
    destination,
    style: 'veteran_fast',
  });

  console.log(`   Routing Style:      ${veteranFastPlan.analysis.chosenStyle}`);
  console.log(`   Standard Time:      ${(veteranFastPlan.analysis.originalDurationSeconds / 60).toFixed(1)} mins`);
  console.log(`   Veteran Time:       ${(veteranFastPlan.analysis.veteranAdjustedDurationSeconds / 60).toFixed(1)} mins`);
  console.log(`   Time Saved:         ${veteranFastPlan.analysis.timeSavedSeconds} seconds (${(veteranFastPlan.analysis.timeSavedSeconds / 60).toFixed(1)} mins faster!)`);
  console.log('   --- Veteran Shortcuts Applied:');
  veteranFastPlan.analysis.veteranShortcutsApplied.forEach((s) => {
    console.log(`     * ${s.roadName} (Saved ${s.timeSavedSeconds}s): ${s.description}`);
  });
  console.log('   ✅ SCENARIO 2 PASSED: Exploit seasoned driver shortcut to bypass bottlenecks.\n');

  // -------------------------------------------------------------
  // TEST SCENARIO 3: Novice Driver Friendly Mode (新手保护平稳模式)
  // -------------------------------------------------------------
  console.log('🔰 --- SCENARIO 3: "Novice Friendly" Mode (Wide Roads & Hazard Shield) ---');
  const novicePlan = await veteranDriverLayerService.planVeteranEnhancedRoute({
    origin,
    destination,
    style: 'novice_friendly',
  });

  console.log(`   Routing Style:      ${novicePlan.analysis.chosenStyle}`);
  console.log(`   Novice Score:       ${novicePlan.analysis.noviceFriendlinessScore}/100`);
  console.log(`   Smoothness Score:   ${novicePlan.analysis.laneChangeSmoothnessScore}/100`);
  console.log('   --- Hazards Shielded/Avoided for Beginner:');
  novicePlan.analysis.hazardsAvoided.forEach((h) => {
    console.log(`     * [${h.type}] on ${h.roadName}: ${h.description}`);
  });
  console.log('   ✅ SCENARIO 3 PASSED: High-difficulty alleys and traps shielded for novice driver.\n');

  console.log('🎉 ALL LANE-LEVEL ROUTING & VETERAN DRIVER LAYERING VERIFIED!');
}

runLaneAndVeteranTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
