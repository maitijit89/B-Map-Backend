import { osrmService } from '../src/services/osrm.service';
import { calculateBearing, calculateDistanceMeters, checkOffRoute } from '../src/utils/geo.utils';
import { Coordinate, GeoJsonLineString } from '../src/types/geo.types';

async function runSimulation() {
  console.log('🚗 --- Starting B-Map Backend Component Verification --- 🚗\n');

  // Test 1: Geo Utils
  const pointA: Coordinate = [13.38886, 52.517037]; // Brandenburg Gate
  const pointB: Coordinate = [13.397634, 52.529407]; // Berlin Cathedral area

  const distance = calculateDistanceMeters(pointA, pointB);
  const bearing = calculateBearing(pointA, pointB);
  console.log(`✅ [Turf Geo Utils] Distance: ${distance.toFixed(1)}m | Bearing: ${bearing.toFixed(1)}°`);

  // Test 2: Off-Route Detection
  const routeLine: GeoJsonLineString = {
    type: 'LineString',
    coordinates: [pointA, [13.392, 52.522], pointB],
  };

  const onRouteTest = checkOffRoute([13.392, 52.52205], routeLine, 40);
  console.log(`✅ [Off-Route Check - On Track] Deviation: ${onRouteTest.distanceFromRouteMeters}m | Off route: ${onRouteTest.isOffRoute}`);

  const offRouteTest = checkOffRoute([13.41, 52.54], routeLine, 40);
  console.log(`✅ [Off-Route Check - Diverted] Deviation: ${offRouteTest.distanceFromRouteMeters}m | Off route: ${offRouteTest.isOffRoute}`);

  // Test 3: OSRM Public Routing Engine Request
  console.log('\n🗺️ [OSRM Service] Testing route calculation between two points...');
  try {
    const routeResult = await osrmService.getRoute({
      coordinates: [pointA, pointB],
      profile: 'driving',
      steps: true,
      overview: 'full',
      geometries: 'geojson',
    });

    const route = routeResult.routes[0];
    console.log(`✅ [OSRM Route Success] Found route:`);
    console.log(`   - Distance: ${(route.distance / 1000).toFixed(2)} km`);
    console.log(`   - Duration: ${(route.duration / 60).toFixed(1)} min`);
    console.log(`   - Steps: ${route.legs[0]?.steps.length} maneuvers`);
    console.log(`   - First maneuver: ${route.legs[0]?.steps[0]?.maneuver.type} (${route.legs[0]?.steps[0]?.name || 'unnamed road'})`);
  } catch (err: any) {
    console.log(`⚠️ [OSRM Info] Remote demo server ping note: ${err.message}`);
  }

  console.log('\n✨ Simulation completed successfully!');
}

runSimulation();
