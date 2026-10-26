import { Coordinate } from '../../core/types/geo.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';

export interface TspOptimizationOptions {
  fixOrigin?: boolean; // Keep origin at index 0 (default: true)
  fixDestination?: boolean; // Keep destination at index N-1 (default: false)
  roundtrip?: boolean; // Return to origin at the end (default: false)
  maxIterations?: number; // Max 2-Opt passes (default: 500)
}

export interface OptimizedWaypoint {
  originalIndex: number;
  newIndex: number;
  coordinate: Coordinate;
}

export interface TspOptimizationResult {
  originalSequence: Coordinate[];
  optimizedSequence: Coordinate[];
  orderedWaypoints: OptimizedWaypoint[];
  originalDistanceMeters: number;
  optimizedDistanceMeters: number;
  distanceSavedMeters: number;
  percentImprovement: number;
  iterationsCount: number;
  isRoundtrip: boolean;
}

/**
 * Traveling Salesperson Problem (TSP) 2-Opt Multi-Stop Route Optimization Engine
 * Implements Greedy Nearest-Neighbor Initialization + 2-Opt Iterative Edge-Exchange Theorem
 * per algorithm.md Section 5.
 */
export class TspOptimizationEngineService {
  /**
   * Optimizes the visiting sequence of a multi-stop itinerary (up to 50 waypoints).
   */
  public optimizeTour(
    waypoints: Coordinate[],
    options: TspOptimizationOptions = {}
  ): TspOptimizationResult {
    const n = waypoints.length;
    if (n <= 2) {
      const dist = n === 2 ? calculateDistanceMeters(waypoints[0], waypoints[1]) : 0;
      return {
        originalSequence: [...waypoints],
        optimizedSequence: [...waypoints],
        orderedWaypoints: waypoints.map((c, i) => ({ originalIndex: i, newIndex: i, coordinate: c })),
        originalDistanceMeters: Math.round(dist),
        optimizedDistanceMeters: Math.round(dist),
        distanceSavedMeters: 0,
        percentImprovement: 0,
        iterationsCount: 0,
        isRoundtrip: options.roundtrip || false,
      };
    }

    const fixOrigin = options.fixOrigin ?? true;
    const fixDestination = options.fixDestination ?? false;
    const roundtrip = options.roundtrip ?? false;
    const maxIterations = options.maxIterations ?? 500;

    // 1. Build Distance Matrix: D[i][j] = geodesic distance in meters
    const distMatrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      distMatrix[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          distMatrix[i][j] = 0;
        } else {
          distMatrix[i][j] = calculateDistanceMeters(waypoints[i], waypoints[j]);
        }
      }
    }

    // Compute baseline distance of original input sequence
    let originalTourIndices: number[] = Array.from({ length: n }, (_, i) => i);
    const originalDistance = this.computeTourDistance(originalTourIndices, distMatrix, roundtrip);

    // 2. PHASE 1: Greedy Nearest-Neighbor Tour Construction (O(N^2))
    let tour = this.constructNearestNeighborTour(n, distMatrix, fixOrigin, fixDestination);

    // 3. PHASE 2: 2-Opt Iterative Edge-Exchange Untangling (O(N^2) per pass)
    let improved = true;
    let iteration = 0;

    const startIdx = fixOrigin ? 1 : 0;
    const endIdx = fixDestination ? n - 2 : n - 1;

    while (improved && iteration < maxIterations) {
      improved = false;
      iteration++;

      for (let i = startIdx; i < endIdx; i++) {
        for (let j = i + 1; j <= endIdx; j++) {
          // Current cost of edges (i-1 -> i) and (j -> j+1)
          const prevI = i === 0 ? (roundtrip ? n - 1 : -1) : i - 1;
          const nextJ = j === n - 1 ? (roundtrip ? 0 : -1) : j + 1;

          let currentCost = 0;
          let swappedCost = 0;

          if (prevI !== -1) {
            currentCost += distMatrix[tour[prevI]][tour[i]];
            swappedCost += distMatrix[tour[prevI]][tour[j]];
          }
          if (nextJ !== -1) {
            currentCost += distMatrix[tour[j]][tour[nextJ]];
            swappedCost += distMatrix[tour[i]][tour[nextJ]];
          }

          // If swapped edge cost is strictly lower, reverse sub-tour between i and j
          if (swappedCost < currentCost - 1e-4) {
            this.reverseSubTour(tour, i, j);
            improved = true;
          }
        }
      }
    }

    const optimizedDistance = this.computeTourDistance(tour, distMatrix, roundtrip);
    const savedMeters = Math.max(0, originalDistance - optimizedDistance);
    const percentImprovement =
      originalDistance > 0 ? Math.round((savedMeters / originalDistance) * 1000) / 10 : 0;

    const orderedWaypoints: OptimizedWaypoint[] = tour.map((origIdx, newIdx) => ({
      originalIndex: origIdx,
      newIndex: newIdx,
      coordinate: waypoints[origIdx],
    }));

    const optimizedSequence = tour.map((idx) => waypoints[idx]);

    return {
      originalSequence: [...waypoints],
      optimizedSequence,
      orderedWaypoints,
      originalDistanceMeters: Math.round(originalDistance),
      optimizedDistanceMeters: Math.round(optimizedDistance),
      distanceSavedMeters: Math.round(savedMeters),
      percentImprovement,
      iterationsCount: iteration,
      isRoundtrip: roundtrip,
    };
  }

  /**
   * Phase 1: Greedy Nearest-Neighbor Tour
   */
  private constructNearestNeighborTour(
    n: number,
    distMatrix: number[][],
    fixOrigin: boolean,
    fixDestination: boolean
  ): number[] {
    const visited = new Set<number>();
    const tour: number[] = [];

    const startNode = 0;
    tour.push(startNode);
    visited.add(startNode);

    if (fixDestination) {
      visited.add(n - 1); // Reserve final node for last
    }

    let current = startNode;
    while (visited.size < (fixDestination ? n - 1 : n)) {
      let nearest = -1;
      let minD = Infinity;

      for (let cand = 0; cand < n; cand++) {
        if (!visited.has(cand) && distMatrix[current][cand] < minD) {
          minD = distMatrix[current][cand];
          nearest = cand;
        }
      }

      if (nearest !== -1) {
        tour.push(nearest);
        visited.add(nearest);
        current = nearest;
      } else {
        break;
      }
    }

    if (fixDestination) {
      tour.push(n - 1);
    }

    return tour;
  }

  /**
   * 2-Opt In-Place Sub-Tour Reversal: tour[i..j]
   */
  private reverseSubTour(tour: number[], i: number, j: number): void {
    while (i < j) {
      const temp = tour[i];
      tour[i] = tour[j];
      tour[j] = temp;
      i++;
      j--;
    }
  }

  /**
   * Computes total distance of a given permutation tour.
   */
  private computeTourDistance(tour: number[], distMatrix: number[][], roundtrip: boolean): number {
    let total = 0;
    for (let i = 0; i < tour.length - 1; i++) {
      total += distMatrix[tour[i]][tour[i + 1]];
    }
    if (roundtrip && tour.length > 1) {
      total += distMatrix[tour[tour.length - 1]][tour[0]];
    }
    return total;
  }
}

export const tspOptimizationEngineService = new TspOptimizationEngineService();
