import * as turf from '@turf/turf';
import { logger } from '../../core/config/logger';
import { Coordinate } from '../../core/types/geo.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import { crowdsourcedTelemetryService } from './crowdsourced-telemetry.service';
import { trafficPredictionService } from './traffic-prediction.service';
import {
  IntersectionNode,
  RoadSegmentEdge,
  RouteStepEta,
  TrafficEtaResponse,
} from './traffic.types';

export class TrafficGraphService {
  // Directed Graph storage: Nodes (Intersections) and Edges (Road Segments)
  private nodes = new Map<string, IntersectionNode>();
  private edges = new Map<string, RoadSegmentEdge>();

  // Dynamic Congestion Re-Weighting Constants from algorithm.md Section 7
  private readonly CONGESTION_ALPHA = 0.65;
  private readonly CONGESTION_BETA = 2.0;

  constructor() {
    this.seedDefaultRoadNetwork();
  }

  /**
   * Registers or updates an intersection node in the road graph.
   */
  public addNode(node: IntersectionNode): void {
    this.nodes.set(node.nodeId, node);
  }

  /**
   * Registers or updates a directed road segment edge in the road graph.
   * Automatically calculates edge weight in MINUTES (not kilometers).
   */
  public addEdge(edge: RoadSegmentEdge): void {
    this.recalculateEdgeWeightInMinutes(edge);
    this.edges.set(edge.segmentId, edge);

    // Update node links
    const fromNode = this.nodes.get(edge.fromNodeId);
    if (fromNode && !fromNode.connectedOutgoingEdgeIds.includes(edge.segmentId)) {
      fromNode.connectedOutgoingEdgeIds.push(edge.segmentId);
    }
    const toNode = this.nodes.get(edge.toNodeId);
    if (toNode && !toNode.connectedIncomingEdgeIds.includes(edge.segmentId)) {
      toNode.connectedIncomingEdgeIds.push(edge.segmentId);
    }
  }

  public getNode(nodeId: string): IntersectionNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getEdge(segmentId: string): RoadSegmentEdge | undefined {
    return this.edges.get(segmentId);
  }

  public getAllEdges(): RoadSegmentEdge[] {
    return Array.from(this.edges.values());
  }

  public getAllNodes(): IntersectionNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Core Road Graph Weighting:
   * Models intersections as nodes and road segments as edges weighted by travel time
   * in MINUTES (not kilometers), incorporating:
   * 1. Physical segment length & current/predicted effective speed
   * 2. Intersection signal wait time / turn penalty
   * 3. Empirical dynamic congestion inflation curve:
   *    w_e = t_free * [1 + alpha * ((v_free - v_actual) / v_free)^beta]
   */
  public recalculateEdgeWeightInMinutes(
    edge: RoadSegmentEdge,
    liveSpeedKmh?: number | null,
    targetDate: Date = new Date()
  ): void {
    const freeFlowSpeed = edge.freeFlowSpeedKmh || 50.0;
    const lengthMeters = edge.lengthMeters || 500;

    // Uncongested free flow duration in minutes
    const tFreeMinutes = lengthMeters / (freeFlowSpeed * (1000 / 60));
    edge.freeFlowTravelTimeMinutes = Math.round(tFreeMinutes * 100) / 100;

    // Traffic prediction incorporating live crowdsourced speed + historical distribution
    const prediction = trafficPredictionService.predictSegmentSpeed(
      edge,
      liveSpeedKmh ?? edge.currentSpeedKmh,
      edge.activeDeviceCount,
      targetDate
    );

    edge.currentSpeedKmh = liveSpeedKmh ?? edge.currentSpeedKmh;
    edge.predictedSpeedKmh = prediction.predictedSpeedKmh;
    edge.effectiveSpeedKmh = prediction.effectiveSpeedKmh;
    edge.congestionLevel = prediction.congestionLevel;

    // Calculate base travel time in minutes based on effective speed
    const baseTravelTimeMinutes = lengthMeters / (edge.effectiveSpeedKmh * (1000 / 60));

    // Dynamic Congestion Re-Weighting formulation
    const speedDeficitRatio = Math.max(0, (freeFlowSpeed - edge.effectiveSpeedKmh) / freeFlowSpeed);
    const congestionInflation =
      this.CONGESTION_ALPHA * Math.pow(speedDeficitRatio, this.CONGESTION_BETA);
    const dynamicCongestionTimeMinutes = tFreeMinutes * (1 + congestionInflation);

    // Intersection delay at the destination node
    const destinationNode = this.nodes.get(edge.toNodeId);
    const intersectionWaitMinutes = destinationNode?.signalCycleWaitMinutes || 0;

    // PRIMARY WEIGHT: Weighted Travel Time in MINUTES
    const calculatedMinutes =
      Math.max(baseTravelTimeMinutes, dynamicCongestionTimeMinutes) + intersectionWaitMinutes;

    edge.travelTimeMinutes = Math.round(calculatedMinutes * 100) / 100;
    edge.delayMinutes = Math.max(0, Math.round((edge.travelTimeMinutes - tFreeMinutes) * 100) / 100);
  }

  /**
   * Refreshes dynamic graph weights across all edges using latest crowdsourced telemetry
   * and current time window in parallel.
   */
  public async refreshAllGraphWeights(targetDate: Date = new Date()): Promise<void> {
    const edgesList = Array.from(this.edges.values());
    await Promise.all(
      edgesList.map(async (edge) => {
        const liveData = await crowdsourcedTelemetryService.getSegmentLiveSpeed(edge.segmentId);
        const liveSpeed = liveData?.hasLiveData ? liveData.harmonicSpeedKmh : null;
        edge.activeDeviceCount = liveData?.activeDevices || 0;
        this.recalculateEdgeWeightInMinutes(edge, liveSpeed, targetDate);
      })
    );
  }

  /**
   * Finds the nearest intersection node in the road graph to a given coordinate.
   */
  public findNearestNode(coord: Coordinate): IntersectionNode | null {
    let nearest: IntersectionNode | null = null;
    let minDistance = Infinity;

    for (const node of this.nodes.values()) {
      // Rapid rectangular bounding box rejection (> ~50km)
      if (
        Math.abs(coord[0] - node.coordinate[0]) > 0.6 ||
        Math.abs(coord[1] - node.coordinate[1]) > 0.6
      ) {
        continue;
      }

      const dist = calculateDistanceMeters(coord, node.coordinate);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = node;
      }
    }

    // Fallback search if coordinate was beyond regional cluster
    if (!nearest) {
      for (const node of this.nodes.values()) {
        const dist = calculateDistanceMeters(coord, node.coordinate);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = node;
        }
      }
    }

    return nearest;
  }

  /**
   * Calculates the optimal route and ETA between origin and destination coordinates
   * using Dijkstra's shortest-duration algorithm weighted in MINUTES (not kilometers).
   */
  public async calculateTrafficEta(
    origin: Coordinate,
    destination: Coordinate,
    departureDate: Date = new Date()
  ): Promise<TrafficEtaResponse> {
    // 1. Refresh live graph edge weights for this departure time window
    await this.refreshAllGraphWeights(departureDate);

    // 2. Resolve origin and destination to nearest intersection nodes
    const startNode = this.findNearestNode(origin);
    const endNode = this.findNearestNode(destination);

    if (!startNode || !endNode) {
      throw new Error('Could not resolve origin or destination to active road network nodes');
    }

    // 3. Dijkstra's Algorithm with Priority Queue on Travel Time in MINUTES
    const shortestRoute = this.runDijkstraShortestDuration(startNode.nodeId, endNode.nodeId);

    // 4. Also calculate a viable alternative route (bypassing the primary bottleneck edge if any)
    const primaryEdgeIds = shortestRoute.edges.map((e) => e.segmentId);
    const mostCongestedEdge = shortestRoute.edges
      .slice()
      .sort((a, b) => b.delayMinutes - a.delayMinutes)[0];

    let alternativeResult: TrafficEtaResponse['alternatives'] = [];
    if (mostCongestedEdge && mostCongestedEdge.delayMinutes > 1.5) {
      try {
        const altRoute = this.runDijkstraShortestDuration(
          startNode.nodeId,
          endNode.nodeId,
          new Set([mostCongestedEdge.segmentId])
        );

        if (altRoute.edges.length > 0 && altRoute.totalMinutes < shortestRoute.totalMinutes * 1.4) {
          const savings = Math.max(0, shortestRoute.totalMinutes - altRoute.totalMinutes);
          alternativeResult.push({
            alternativeId: `alt_${Date.now()}`,
            name: `Via Alternative Bypass (Avoids ${mostCongestedEdge.name})`,
            totalEtaMinutes: Math.round(altRoute.totalMinutes * 10) / 10,
            totalDistanceKm: Math.round((altRoute.totalDistanceMeters / 1000) * 10) / 10,
            delayMinutes: Math.round(altRoute.totalDelayMinutes * 10) / 10,
            congestionLevel: altRoute.overallCongestion,
            savingsMinutesVsBaseline: Math.round(savings * 10) / 10,
          });
        }
      } catch {
        // Fallback gracefully if no alternative exists
      }
    }

    // 5. Construct Step-by-Step Response
    const steps: RouteStepEta[] = [];
    const fullPolyline: Coordinate[] = [origin];
    const intersectionsCrossed: TrafficEtaResponse['intersectionsCrossed'] = [];

    for (let i = 0; i < shortestRoute.edges.length; i++) {
      const edge = shortestRoute.edges[i];
      const fromN = this.nodes.get(edge.fromNodeId)!;
      const toN = this.nodes.get(edge.toNodeId)!;

      steps.push({
        stepIndex: i + 1,
        segmentId: edge.segmentId,
        roadName: edge.name,
        fromIntersection: fromN.name,
        toIntersection: toN.name,
        lengthMeters: edge.lengthMeters,
        travelTimeMinutes: edge.travelTimeMinutes,
        travelTimeSeconds: Math.round(edge.travelTimeMinutes * 60),
        speedKmh: edge.effectiveSpeedKmh,
        freeFlowSpeedKmh: edge.freeFlowSpeedKmh,
        delayMinutes: edge.delayMinutes,
        congestionLevel: edge.congestionLevel,
        geometry: edge.geometry,
      });

      if (edge.geometry && edge.geometry.length > 0) {
        fullPolyline.push(...edge.geometry);
      }

      intersectionsCrossed.push({
        nodeId: toN.nodeId,
        name: toN.name,
        type: toN.intersectionType,
        waitMinutes: toN.signalCycleWaitMinutes,
        coordinate: toN.coordinate,
      });
    }

    fullPolyline.push(destination);

    const totalSeconds = Math.round(shortestRoute.totalMinutes * 60);
    const averageSpeedKmh =
      shortestRoute.totalMinutes > 0
        ? Math.round(
            ((shortestRoute.totalDistanceMeters / 1000) / (shortestRoute.totalMinutes / 60)) * 10
          ) / 10
        : 50.0;

    return {
      routeId: `traffic_route_${Date.now()}`,
      origin,
      destination,
      totalDistanceMeters: Math.round(shortestRoute.totalDistanceMeters),
      totalDistanceKm: Math.round((shortestRoute.totalDistanceMeters / 1000) * 10) / 10,
      totalEtaMinutes: Math.round(shortestRoute.totalMinutes * 10) / 10,
      totalEtaSeconds: totalSeconds,
      freeFlowDurationMinutes: Math.round(shortestRoute.freeFlowMinutes * 10) / 10,
      totalDelayMinutes: Math.round(shortestRoute.totalDelayMinutes * 10) / 10,
      overallCongestionLevel: shortestRoute.overallCongestion,
      averageSpeedKmh,
      estimatedArrivalEpoch: departureDate.getTime() + totalSeconds * 1000,
      bottlenecksCount: shortestRoute.edges.filter(
        (e) => e.congestionLevel === 'congested' || e.congestionLevel === 'severe_gridlock'
      ).length,
      intersectionsCrossed,
      steps,
      fullPolyline,
      alternatives: alternativeResult,
    };
  }

  /**
   * Dijkstra pathfinding prioritizing minimum travel time in MINUTES (not distance).
   */
  private runDijkstraShortestDuration(
    startNodeId: string,
    endNodeId: string,
    bannedEdgeIds: Set<string> = new Set()
  ): {
    edges: RoadSegmentEdge[];
    totalMinutes: number;
    freeFlowMinutes: number;
    totalDelayMinutes: number;
    totalDistanceMeters: number;
    overallCongestion: RoadSegmentEdge['congestionLevel'];
  } {
    const distances = new Map<string, number>(); // NodeId -> cumulative travel time in MINUTES
    const previous = new Map<string, { nodeId: string; edge: RoadSegmentEdge }>();
    const unvisited = new Set<string>();

    for (const nodeId of this.nodes.keys()) {
      distances.set(nodeId, Infinity);
      unvisited.add(nodeId);
    }
    distances.set(startNodeId, 0);

    while (unvisited.size > 0) {
      // Find unvisited node with lowest travel time in minutes
      let currentMinNode: string | null = null;
      let lowestTime = Infinity;

      for (const nodeId of unvisited) {
        const time = distances.get(nodeId)!;
        if (time < lowestTime) {
          lowestTime = time;
          currentMinNode = nodeId;
        }
      }

      if (!currentMinNode || lowestTime === Infinity) {
        break; // Destination unreachable
      }

      if (currentMinNode === endNodeId) {
        break; // Target reached
      }

      unvisited.delete(currentMinNode);
      const currentNode = this.nodes.get(currentMinNode)!;

      // Examine outgoing road segments
      for (const edgeId of currentNode.connectedOutgoingEdgeIds) {
        if (bannedEdgeIds.has(edgeId)) continue;

        const edge = this.edges.get(edgeId);
        if (!edge) continue;

        const neighborId = edge.toNodeId;
        if (!unvisited.has(neighborId)) continue;

        // Weight is travel time in MINUTES
        const edgeWeightMinutes = edge.travelTimeMinutes;
        const candidateTime = lowestTime + edgeWeightMinutes;

        if (candidateTime < distances.get(neighborId)!) {
          distances.set(neighborId, candidateTime);
          previous.set(neighborId, { nodeId: currentMinNode, edge });
        }
      }
    }

    // Reconstruct path
    const pathEdges: RoadSegmentEdge[] = [];
    let curr = endNodeId;

    while (previous.has(curr)) {
      const step = previous.get(curr)!;
      pathEdges.unshift(step.edge);
      curr = step.nodeId;
    }

    if (pathEdges.length === 0 && startNodeId !== endNodeId) {
      throw new Error(`No route found between node ${startNodeId} and ${endNodeId}`);
    }

    const totalMinutes = pathEdges.reduce((acc, e) => acc + e.travelTimeMinutes, 0);
    const freeFlowMinutes = pathEdges.reduce((acc, e) => acc + e.freeFlowTravelTimeMinutes, 0);
    const totalDelayMinutes = Math.max(0, totalMinutes - freeFlowMinutes);
    const totalDistanceMeters = pathEdges.reduce((acc, e) => acc + e.lengthMeters, 0);

    // Congestion determination
    const severeCount = pathEdges.filter((e) => e.congestionLevel === 'severe_gridlock').length;
    const congestedCount = pathEdges.filter((e) => e.congestionLevel === 'congested').length;
    const slowCount = pathEdges.filter((e) => e.congestionLevel === 'slow').length;

    let overallCongestion: RoadSegmentEdge['congestionLevel'] = 'free_flow';
    if (severeCount > 0) {
      overallCongestion = 'severe_gridlock';
    } else if (congestedCount > 0 || slowCount >= pathEdges.length / 2) {
      overallCongestion = 'congested';
    } else if (slowCount > 0) {
      overallCongestion = 'slow';
    }

    return {
      edges: pathEdges,
      totalMinutes,
      freeFlowMinutes,
      totalDelayMinutes,
      totalDistanceMeters,
      overallCongestion,
    };
  }

  /**
   * Seeds an interconnected road graph network covering major urban arterial corridors,
   * expressways, flyovers, roundabouts, and intersections (e.g., Delhi-NCR / Gurugram / Cyber City).
   */
  private seedDefaultRoadNetwork(): void {
    // 1. Intersections (Nodes)
    const seedNodes: IntersectionNode[] = [
      {
        nodeId: 'INT_CP_01',
        name: 'Connaught Place Outer Circle Junction',
        coordinate: [77.2185, 28.6328],
        intersectionType: 'roundabout',
        signalCycleWaitMinutes: 0.8,
        connectedOutgoingEdgeIds: [],
        connectedIncomingEdgeIds: [],
      },
      {
        nodeId: 'INT_BARAKHAMBA_02',
        name: 'Barakhamba Road - Mandi House Intersection',
        coordinate: [77.2345, 28.6258],
        intersectionType: 'signalized',
        signalCycleWaitMinutes: 1.2,
        connectedOutgoingEdgeIds: [],
        connectedIncomingEdgeIds: [],
      },
      {
        nodeId: 'INT_ITO_03',
        name: 'ITO Flyover & Ring Road Merge',
        coordinate: [77.2485, 28.6295],
        intersectionType: 'flyover_merge',
        signalCycleWaitMinutes: 0.5,
        connectedOutgoingEdgeIds: [],
        connectedIncomingEdgeIds: [],
      },
      {
        nodeId: 'INT_AIIMS_04',
        name: 'AIIMS Ring Road Flyover Junction',
        coordinate: [77.2095, 28.5685],
        intersectionType: 'signalized',
        signalCycleWaitMinutes: 1.0,
        connectedOutgoingEdgeIds: [],
        connectedIncomingEdgeIds: [],
      },
      {
        nodeId: 'INT_DHAULA_KUAN_05',
        name: 'Dhaula Kuan Cloverleaf Interchange',
        coordinate: [77.1615, 28.5915],
        intersectionType: 'cloverleaf_ramp',
        signalCycleWaitMinutes: 0.4,
        connectedOutgoingEdgeIds: [],
        connectedIncomingEdgeIds: [],
      },
      {
        nodeId: 'INT_CYBER_HUB_06',
        name: 'DLF Cyber Hub Expressway Exit 17',
        coordinate: [77.0885, 28.4955],
        intersectionType: 'flyover_merge',
        signalCycleWaitMinutes: 0.6,
        connectedOutgoingEdgeIds: [],
        connectedIncomingEdgeIds: [],
      },
      {
        nodeId: 'INT_IFFCO_CHOWK_07',
        name: 'IFFCO Chowk Metro & Arterial Junction',
        coordinate: [77.0715, 28.4725],
        intersectionType: 'signalized',
        signalCycleWaitMinutes: 1.4,
        connectedOutgoingEdgeIds: [],
        connectedIncomingEdgeIds: [],
      },
      {
        nodeId: 'INT_MG_ROAD_08',
        name: 'MG Road - Golf Course Road Intersection',
        coordinate: [77.0955, 28.4815],
        intersectionType: 'signalized',
        signalCycleWaitMinutes: 1.1,
        connectedOutgoingEdgeIds: [],
        connectedIncomingEdgeIds: [],
      },
    ];

    for (const node of seedNodes) {
      this.addNode(node);
    }

    // 2. Road Segments (Edges) connecting the intersections
    const seedEdges: Omit<
      RoadSegmentEdge,
      | 'travelTimeMinutes'
      | 'freeFlowTravelTimeMinutes'
      | 'delayMinutes'
      | 'congestionLevel'
      | 'predictedSpeedKmh'
      | 'effectiveSpeedKmh'
    >[] = [
      {
        segmentId: 'SEG_CP_BARAKHAMBA_01',
        name: 'Barakhamba Road Corridor',
        fromNodeId: 'INT_CP_01',
        toNodeId: 'INT_BARAKHAMBA_02',
        lengthMeters: 1650,
        roadType: 'arterial',
        freeFlowSpeedKmh: 50.0,
        currentSpeedKmh: 45.0,
        oneWay: false,
        activeDeviceCount: 14,
        lastTelemetryTimestamp: Date.now(),
        geometry: [
          [77.2185, 28.6328],
          [77.2265, 28.6293],
          [77.2345, 28.6258],
        ],
      },
      {
        segmentId: 'SEG_BARAKHAMBA_ITO_02',
        name: 'Vikas Marg - ITO Flyover Approach',
        fromNodeId: 'INT_BARAKHAMBA_02',
        toNodeId: 'INT_ITO_03',
        lengthMeters: 1850,
        roadType: 'arterial',
        freeFlowSpeedKmh: 50.0,
        currentSpeedKmh: 28.0, // Congestion hotspot
        oneWay: false,
        activeDeviceCount: 22,
        lastTelemetryTimestamp: Date.now(),
        geometry: [
          [77.2345, 28.6258],
          [77.2415, 28.6275],
          [77.2485, 28.6295],
        ],
      },
      {
        segmentId: 'SEG_CP_DHAULA_03',
        name: 'Sardar Patel Marg Arterial Corridor',
        fromNodeId: 'INT_CP_01',
        toNodeId: 'INT_DHAULA_KUAN_05',
        lengthMeters: 6200,
        roadType: 'arterial',
        freeFlowSpeedKmh: 60.0,
        currentSpeedKmh: 55.0,
        oneWay: false,
        activeDeviceCount: 38,
        lastTelemetryTimestamp: Date.now(),
        geometry: [
          [77.2185, 28.6328],
          [77.1955, 28.6145],
          [77.1785, 28.6015],
          [77.1615, 28.5915],
        ],
      },
      {
        segmentId: 'SEG_DHAULA_AIIMS_04',
        name: 'Mahatma Gandhi Ring Road South',
        fromNodeId: 'INT_DHAULA_KUAN_05',
        toNodeId: 'INT_AIIMS_04',
        lengthMeters: 5400,
        roadType: 'arterial',
        freeFlowSpeedKmh: 60.0,
        currentSpeedKmh: 42.0,
        oneWay: false,
        activeDeviceCount: 45,
        lastTelemetryTimestamp: Date.now(),
        geometry: [
          [77.1615, 28.5915],
          [77.1855, 28.5795],
          [77.2095, 28.5685],
        ],
      },
      {
        segmentId: 'SEG_DHAULA_CYBER_05',
        name: 'Delhi-Gurugram Expressway (NH-48)',
        fromNodeId: 'INT_DHAULA_KUAN_05',
        toNodeId: 'INT_CYBER_HUB_06',
        lengthMeters: 13500,
        roadType: 'expressway',
        freeFlowSpeedKmh: 90.0,
        currentSpeedKmh: 75.0,
        oneWay: false,
        activeDeviceCount: 88,
        lastTelemetryTimestamp: Date.now(),
        geometry: [
          [77.1615, 28.5915],
          [77.1255, 28.5455],
          [77.1015, 28.5125],
          [77.0885, 28.4955],
        ],
      },
      {
        segmentId: 'SEG_CYBER_IFFCO_06',
        name: 'NH-48 Sirhaul - IFFCO Chowk Corridor',
        fromNodeId: 'INT_CYBER_HUB_06',
        toNodeId: 'INT_IFFCO_CHOWK_07',
        lengthMeters: 3200,
        roadType: 'expressway',
        freeFlowSpeedKmh: 80.0,
        currentSpeedKmh: 35.0, // Peak hour bottleneck
        oneWay: false,
        activeDeviceCount: 52,
        lastTelemetryTimestamp: Date.now(),
        geometry: [
          [77.0885, 28.4955],
          [77.0795, 28.4835],
          [77.0715, 28.4725],
        ],
      },
      {
        segmentId: 'SEG_CYBER_MGROAD_07',
        name: 'Golf Course Road Elevated Road Bypass',
        fromNodeId: 'INT_CYBER_HUB_06',
        toNodeId: 'INT_MG_ROAD_08',
        lengthMeters: 2100,
        roadType: 'arterial',
        freeFlowSpeedKmh: 60.0,
        currentSpeedKmh: 58.0, // Fast alternative bypass
        oneWay: false,
        activeDeviceCount: 19,
        lastTelemetryTimestamp: Date.now(),
        geometry: [
          [77.0885, 28.4955],
          [77.0915, 28.4885],
          [77.0955, 28.4815],
        ],
      },
      {
        segmentId: 'SEG_MGROAD_IFFCO_08',
        name: 'Mehrauli-Gurgaon (MG) Road Arterial',
        fromNodeId: 'INT_MG_ROAD_08',
        toNodeId: 'INT_IFFCO_CHOWK_07',
        lengthMeters: 2800,
        roadType: 'arterial',
        freeFlowSpeedKmh: 50.0,
        currentSpeedKmh: 46.0,
        oneWay: false,
        activeDeviceCount: 26,
        lastTelemetryTimestamp: Date.now(),
        geometry: [
          [77.0955, 28.4815],
          [77.0835, 28.4775],
          [77.0715, 28.4725],
        ],
      },
    ];

    for (const rawEdge of seedEdges) {
      const fullEdge: RoadSegmentEdge = {
        ...rawEdge,
        predictedSpeedKmh: rawEdge.currentSpeedKmh,
        effectiveSpeedKmh: rawEdge.currentSpeedKmh,
        travelTimeMinutes: 0,
        freeFlowTravelTimeMinutes: 0,
        delayMinutes: 0,
        congestionLevel: 'free_flow',
      };
      this.addEdge(fullEdge);
    }
  }
}

export const trafficGraphService = new TrafficGraphService();
export const trafficGraphEngineService = trafficGraphService;
