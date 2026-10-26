import { logger } from '../../core/config/logger';
import { TrafficCongestionLevel } from '../car-navigation/car-navigation.types';
import {
  HistoricalSpeedBucket,
  RoadClassification,
  RoadSegmentEdge,
} from './traffic.types';

export class TrafficPredictionService {
  // In-memory historical patterns cache: segmentId -> Map<"day_bucket", HistoricalSpeedBucket>
  private historicalDistributions = new Map<string, Map<string, HistoricalSpeedBucket>>();

  /**
   * Computes the 15-minute time bucket index (0..95) from a given Date or Epoch timestamp.
   * e.g., 08:35 AM -> (8 * 60 + 35) / 15 = 515 / 15 = 34
   */
  public getTimeBucketIndex(date: Date = new Date()): {
    dayOfWeek: number;
    timeBucketIndex: number;
    timeWindowLabel: string;
  } {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ...
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const timeBucketIndex = Math.min(95, Math.floor(totalMinutes / 15));

    const startH = Math.floor((timeBucketIndex * 15) / 60);
    const startM = (timeBucketIndex * 15) % 60;
    const endTotal = (timeBucketIndex + 1) * 15;
    const endH = Math.floor(endTotal / 60);
    const endM = endTotal % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeWindowLabel = `${pad(startH)}:${pad(startM)}-${pad(endH)}:${pad(endM)}`;

    return {
      dayOfWeek,
      timeBucketIndex,
      timeWindowLabel,
    };
  }

  /**
   * Retrieves or synthesizes the historical speed distribution for a road segment
   * at a specific time window.
   */
  public getHistoricalSpeedBucket(
    segment: RoadSegmentEdge,
    targetDate: Date = new Date()
  ): HistoricalSpeedBucket {
    const { dayOfWeek, timeBucketIndex, timeWindowLabel } = this.getTimeBucketIndex(targetDate);
    const cacheKey = `${dayOfWeek}_${timeBucketIndex}`;

    const segmentMap = this.historicalDistributions.get(segment.segmentId);
    if (segmentMap && segmentMap.has(cacheKey)) {
      return segmentMap.get(cacheKey)!;
    }

    // Synthesize realistic historical distribution based on road classification, day, and time
    const synthesized = this.generateBaselineHistoricalBucket(
      segment,
      dayOfWeek,
      timeBucketIndex,
      timeWindowLabel
    );

    if (!this.historicalDistributions.has(segment.segmentId)) {
      this.historicalDistributions.set(segment.segmentId, new Map());
    }
    this.historicalDistributions.get(segment.segmentId)!.set(cacheKey, synthesized);

    return synthesized;
  }

  /**
   * Core Traffic Prediction: Combines live real-time observed speed with historical speed
   * distribution for that specific time window using Bayesian/Kalman-inspired weighted blending.
   *
   * @param segment Road segment to predict for
   * @param liveSpeedKmh Real-time observed speed (if any)
   * @param liveDeviceCount Number of active devices contributing
   * @param targetArrivalDate Estimated time of vehicle arrival at this segment
   */
  public predictSegmentSpeed(
    segment: RoadSegmentEdge,
    liveSpeedKmh?: number | null,
    liveDeviceCount = 0,
    targetArrivalDate: Date = new Date()
  ): {
    predictedSpeedKmh: number;
    effectiveSpeedKmh: number;
    congestionLevel: TrafficCongestionLevel;
    confidenceScore: number;
    weightLiveUsed: number;
    historicalMeanSpeedKmh: number;
    freeFlowSpeedKmh: number;
    delaySeconds: number;
    timeWindowLabel: string;
  } {
    const historicalBucket = this.getHistoricalSpeedBucket(segment, targetArrivalDate);
    const freeFlow = segment.freeFlowSpeedKmh || historicalBucket.freeFlowSpeedKmh || 50.0;
    const histMean = historicalBucket.meanSpeedKmh;

    const now = Date.now();
    const arrivalEpoch = targetArrivalDate.getTime();
    const lookaheadMinutes = Math.max(0, (arrivalEpoch - now) / 60000);

    let predictedSpeedKmh: number;
    let weightLive = 0;
    let confidenceScore = 0.85;

    if (liveSpeedKmh !== undefined && liveSpeedKmh !== null && liveDeviceCount > 0) {
      // Base live confidence depends on device density (1 device = 0.6, 3+ devices = 0.95)
      const densityConfidence = Math.min(0.95, 0.45 + liveDeviceCount * 0.17);

      // Lookahead decay: as lookahead minutes increase into future, live observations fade
      // into historical distribution (half-life of ~20 minutes)
      const lookaheadDecay = Math.exp(-lookaheadMinutes / 20.0);

      weightLive = densityConfidence * lookaheadDecay;
      weightLive = Math.max(0, Math.min(0.98, weightLive));

      // Blended prediction: w_live * v_live + (1 - w_live) * v_historical
      predictedSpeedKmh = weightLive * liveSpeedKmh + (1 - weightLive) * histMean;
      confidenceScore = Math.max(0.75, densityConfidence);
    } else {
      // Pure historical fallback for segments with no active telemetry
      predictedSpeedKmh = histMean;
      weightLive = 0;
      confidenceScore = 0.8;
    }

    predictedSpeedKmh = Math.max(5.0, Math.round(predictedSpeedKmh * 10) / 10);
    const effectiveSpeedKmh = Math.min(freeFlow, predictedSpeedKmh);

    // Congestion Classification
    const speedRatio = effectiveSpeedKmh / freeFlow;
    let congestionLevel: TrafficCongestionLevel = 'free_flow';

    if (speedRatio >= 0.8) {
      congestionLevel = 'free_flow'; // Green
    } else if (speedRatio >= 0.5) {
      congestionLevel = 'slow'; // Yellow
    } else if (speedRatio >= 0.25) {
      congestionLevel = 'congested'; // Orange/Red
    } else {
      congestionLevel = 'severe_gridlock'; // Dark Red
    }

    // Compute delay relative to free flow duration
    const segmentLengthMeters = segment.lengthMeters || 500;
    const freeFlowSeconds = (segmentLengthMeters / (freeFlow * (1000 / 3600)));
    const travelSeconds = (segmentLengthMeters / (effectiveSpeedKmh * (1000 / 3600)));
    const delaySeconds = Math.max(0, Math.round(travelSeconds - freeFlowSeconds));

    return {
      predictedSpeedKmh,
      effectiveSpeedKmh,
      congestionLevel,
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      weightLiveUsed: Math.round(weightLive * 100) / 100,
      historicalMeanSpeedKmh: Math.round(histMean * 10) / 10,
      freeFlowSpeedKmh: freeFlow,
      delaySeconds,
      timeWindowLabel: historicalBucket.timeWindowLabel,
    };
  }

  /**
   * Generates realistic historical speed profiles for Indian road tiers across 96 daily time buckets.
   */
  private generateBaselineHistoricalBucket(
    segment: RoadSegmentEdge,
    dayOfWeek: number,
    timeBucketIndex: number,
    timeWindowLabel: string
  ): HistoricalSpeedBucket {
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const hour = (timeBucketIndex * 15) / 60;

    const baseFreeFlow = this.getBaseFreeFlowSpeed(segment.roadType);
    let speedFactor = 1.0;
    let congestionProb = 0.05;

    // Daily Traffic Profile Curves
    if (!isWeekend) {
      // Weekday Morning Rush: 08:30 - 11:00
      if (hour >= 8.5 && hour <= 11.0) {
        speedFactor = segment.roadType === 'arterial' ? 0.38 : 0.52;
        congestionProb = 0.85;
      }
      // Weekday Evening Rush: 17:30 - 21:00
      else if (hour >= 17.5 && hour <= 21.0) {
        speedFactor = segment.roadType === 'arterial' ? 0.32 : 0.45;
        congestionProb = 0.92;
      }
      // Midday Traffic: 12:00 - 16:30
      else if (hour >= 12.0 && hour <= 16.5) {
        speedFactor = 0.72;
        congestionProb = 0.35;
      }
      // Night / Late Evening: 22:00 - 06:30
      else if (hour >= 22.0 || hour <= 6.5) {
        speedFactor = 0.96;
        congestionProb = 0.02;
      } else {
        speedFactor = 0.82;
        congestionProb = 0.2;
      }
    } else {
      // Weekend Profile (Leisure / Afternoon Shopping Surge)
      if (hour >= 16.0 && hour <= 21.5) {
        speedFactor = 0.62;
        congestionProb = 0.55;
      } else if (hour >= 12.0 && hour < 16.0) {
        speedFactor = 0.75;
        congestionProb = 0.3;
      } else {
        speedFactor = 0.94;
        congestionProb = 0.05;
      }
    }

    const meanSpeedKmh = Math.max(10.0, Math.round(baseFreeFlow * speedFactor * 10) / 10);
    const standardDeviationKmh = Math.round(meanSpeedKmh * 0.18 * 10) / 10;
    const lengthMeters = segment.lengthMeters || 500;
    const freeFlowSecs = lengthMeters / (baseFreeFlow * (1000 / 3600));
    const expectedSecs = lengthMeters / (meanSpeedKmh * (1000 / 3600));
    const p95DelaySeconds = Math.max(0, Math.round(expectedSecs - freeFlowSecs) * 1.5);

    return {
      dayOfWeek,
      timeBucketIndex,
      timeWindowLabel,
      meanSpeedKmh,
      standardDeviationKmh,
      sampleCount: 1420,
      congestionProbability: congestionProb,
      freeFlowSpeedKmh: baseFreeFlow,
      p95DelaySeconds,
    };
  }

  private getBaseFreeFlowSpeed(roadType: RoadClassification): number {
    switch (roadType) {
      case 'expressway':
        return 100.0;
      case 'national_highway':
        return 80.0;
      case 'arterial':
        return 50.0;
      case 'sub_arterial':
        return 40.0;
      case 'collector':
        return 35.0;
      case 'local_street':
        return 25.0;
      case 'service_lane':
        return 20.0;
      default:
        return 45.0;
    }
  }
}

export const trafficPredictionService = new TrafficPredictionService();
