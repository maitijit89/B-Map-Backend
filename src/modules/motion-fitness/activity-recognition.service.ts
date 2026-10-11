import mongoose from 'mongoose';
import { logger } from '../../core/config/logger';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import { NavigationSession } from '../navigation/navigation-session.model';
import { sessionValidationService } from '../location-access/session-validation.service';
import {
  AlgorithmicActionTrigger,
  AutomatedPingNotification,
  ContextAwareRoutingSuggestion,
  MotionActivityPayload,
  MotionEvaluationResult,
  PhysicalActivityType,
} from './motion-fitness.types';

interface TripMotionState {
  tripId: string;
  userId: string;
  lastActivity: PhysicalActivityType;
  lastConfidence: number;
  stillStartedAt: number | null;
  hasTriggeredInactivityAlert: boolean;
  isAutoPaused: boolean;
  tripStatus: 'active' | 'paused' | 'completed' | 'cancelled';
  lastCoordinates?: [number, number];
  currentProfile: 'driving' | 'bike' | 'foot';
}

export class ActivityRecognitionService {
  private tripStateMap = new Map<string, TripMotionState>();

  // 5 minutes STILL threshold (300,000 milliseconds)
  private stillThresholdMs: number = 5 * 60 * 1000;

  /**
   * Allows setting a custom STILL threshold (useful for testing or customized fleet requirements).
   */
  setStillThresholdMs(thresholdMs: number): void {
    this.stillThresholdMs = thresholdMs;
  }

  getStillThresholdMs(): number {
    return this.stillThresholdMs;
  }

  /**
   * Normalizes activity from Android DetectedActivity / iOS CMMotionActivity.
   */
  normalizeActivity(activity: PhysicalActivityType): PhysicalActivityType {
    switch (activity) {
      case 'IN_VEHICLE':
        return 'DRIVING';
      case 'ON_BICYCLE':
        return 'CYCLING';
      case 'ON_FOOT':
        return 'WALKING';
      default:
        return activity;
    }
  }

  /**
   * Processes incoming physical activity state and coordinates.
   * Performs algorithmic state switching:
   * - STILL for > 5 minutes near destination (<= 150m) -> Prompts arrival confirmation.
   * - STILL for > 5 minutes with heavy congestion -> Alerts driver of traffic delay with alternative routes.
   * - STILL for > 5 minutes idle -> Auto-pauses navigation session.
   * - Motion resumes -> Auto-resumes navigation.
   * - Motion mismatch -> Context-aware routing profile suggestions.
   */
  async processActivityUpdate(payload: MotionActivityPayload): Promise<MotionEvaluationResult> {
    const now = payload.timestamp || Date.now();
    const { tripId, userId, confidence } = payload;
    const normalizedActivity = this.normalizeActivity(payload.activity);

    // Retrieve or initialize motion state for trip
    let state = this.tripStateMap.get(tripId);
    if (!state) {
      state = {
        tripId,
        userId,
        lastActivity: normalizedActivity,
        lastConfidence: confidence,
        stillStartedAt: normalizedActivity === 'STILL' ? now : null,
        hasTriggeredInactivityAlert: false,
        isAutoPaused: false,
        tripStatus: 'active',
        lastCoordinates: payload.coordinates,
        currentProfile: 'driving',
      };
      this.tripStateMap.set(tripId, state);
    }

    state.lastActivity = normalizedActivity;
    state.lastConfidence = confidence;
    if (payload.coordinates) {
      state.lastCoordinates = payload.coordinates;
    }

    const isStill = normalizedActivity === 'STILL' || (payload.speed !== undefined && payload.speed < 0.8 && normalizedActivity === 'UNKNOWN');

    let actionTriggered: AlgorithmicActionTrigger = 'NONE';
    let automatedPing: AutomatedPingNotification | undefined;
    let contextAwareRouting: ContextAwareRoutingSuggestion | undefined;

    // Fetch active session metadata (destination coordinates, remaining distance)
    const sessionValidation = await sessionValidationService.validateActiveTripSession(tripId, userId);
    let distanceToDestinationMeters = sessionValidation.session?.remainingDistanceMeters ?? 2000;

    if (payload.coordinates && sessionValidation.session?.destinationCoordinates) {
      distanceToDestinationMeters = Math.round(
        calculateDistanceMeters(payload.coordinates, sessionValidation.session.destinationCoordinates)
      );
    }

    // =========================================================================
    // 1. STILL STATE ACCUMULATION & 5-MINUTE ALGORITHMIC STATE SWITCHING
    // =========================================================================
    if (isStill) {
      if (state.stillStartedAt === null) {
        state.stillStartedAt = now;
        state.hasTriggeredInactivityAlert = false;
      }

      const stillDurationMs = now - state.stillStartedAt;

      // When STILL exceeds threshold (5 minutes)
      if (stillDurationMs >= this.stillThresholdMs && !state.hasTriggeredInactivityAlert) {
        state.hasTriggeredInactivityAlert = true;

        // Condition A: User has stopped moving within 150m of destination -> Arrived Check
        if (distanceToDestinationMeters <= 150) {
          actionTriggered = 'ARRIVAL_CONFIRMATION';
          automatedPing = {
            shouldNotifyClient: true,
            title: 'Arrived at Destination?',
            message: `You have been stopped near your destination for over 5 minutes. Would you like to complete this trip?`,
            actionType: 'CONFIRM_ARRIVAL',
            suggestedActionPayload: {
              tripId,
              distanceToDestinationMeters,
              suggestedAction: 'complete_trip',
            },
          };
          logger.info(`🎯 [ACTIVITY] Trip ${tripId}: STILL for >5 mins near destination (${distanceToDestinationMeters}m). Triggered arrival confirmation.`);
        }
        // Condition B: Stationary on route with heavy congestion -> Stuck-in-Traffic Check
        else if (payload.trafficCongestionLevel === 'HEAVY' || payload.trafficCongestionLevel === 'STANDSTILL') {
          actionTriggered = 'STUCK_IN_TRAFFIC_ALERT';
          automatedPing = {
            shouldNotifyClient: true,
            title: 'Traffic Delay Detected',
            message: `You have been stationary for 5 minutes. Traffic congestion detected on your corridor. Checking alternative routes...`,
            actionType: 'CHECK_TRAFFIC',
            suggestedActionPayload: {
              tripId,
              trafficCongestionLevel: payload.trafficCongestionLevel,
              requestReroute: true,
            },
          };
          logger.info(`🚦 [ACTIVITY] Trip ${tripId}: STILL for >5 mins in traffic (${payload.trafficCongestionLevel}). Triggered traffic check.`);
        }
        // Condition C: General prolonged stillness (>5 mins) -> Auto-Pause Navigation
        else {
          actionTriggered = 'AUTO_PAUSE';
          state.isAutoPaused = true;
          state.tripStatus = 'paused';

          // Update session status asynchronously
          this.updateSessionStatus(tripId, 'paused');

          automatedPing = {
            shouldNotifyClient: true,
            title: 'Trip Auto-Paused',
            message: `Navigation auto-paused due to 5+ minutes of inactivity (STILL). Tap to resume or end trip.`,
            actionType: 'RESUME_NAVIGATION',
            suggestedActionPayload: {
              tripId,
              stillDurationSeconds: Math.round(stillDurationMs / 1000),
            },
          };
          logger.info(`⏸️ [ACTIVITY] Trip ${tripId}: Driver STILL for >5 mins. Navigation automatically paused to save battery.`);
        }
      }
    } else {
      // User is in motion (DRIVING, WALKING, CYCLING, RUNNING) or speed > 5 km/h
      const wasPaused = state.isAutoPaused;

      state.stillStartedAt = null;
      state.hasTriggeredInactivityAlert = false;

      // If trip was auto-paused, automatically resume it upon movement
      if (wasPaused) {
        state.isAutoPaused = false;
        state.tripStatus = 'active';
        actionTriggered = 'AUTO_RESUME';

        this.updateSessionStatus(tripId, 'active');

        automatedPing = {
          shouldNotifyClient: true,
          title: 'Navigation Resumed',
          message: `Movement detected (${normalizedActivity}). Navigation session automatically resumed.`,
          actionType: 'RESUME_NAVIGATION',
          suggestedActionPayload: {
            tripId,
            detectedActivity: normalizedActivity,
          },
        };
        logger.info(`▶️ [ACTIVITY] Trip ${tripId}: Movement resumed (${normalizedActivity}). Trip auto-resumed.`);
      }

      // =========================================================================
      // 2. CONTEXT-AWARE ROUTING PROFILE SUGGESTIONS
      // =========================================================================
      if (state.currentProfile === 'driving' && normalizedActivity === 'WALKING' && confidence >= 75) {
        if (distanceToDestinationMeters <= 400) {
          actionTriggered = 'MODE_SWITCH_SUGGESTION';
          contextAwareRouting = {
            currentProfile: 'driving',
            suggestedProfile: 'foot',
            reason: `Driver parked vehicle and is now walking. Switching to Last-Mile Pedestrian Guidance to destination door.`,
          };
        }
      } else if (state.currentProfile === 'foot' && normalizedActivity === 'DRIVING' && confidence >= 85) {
        actionTriggered = 'MODE_SWITCH_SUGGESTION';
        contextAwareRouting = {
          currentProfile: 'foot',
          suggestedProfile: 'driving',
          reason: `High-speed vehicular movement detected (${confidence}% confidence). Switching to Driving Navigation.`,
        };
      }
    }

    const stillDurationSeconds = state.stillStartedAt ? Math.round((now - state.stillStartedAt) / 1000) : 0;

    return {
      tripId,
      userId,
      currentActivity: normalizedActivity,
      confidence,
      isStill,
      stillDurationSeconds,
      stillThresholdSeconds: Math.round(this.stillThresholdMs / 1000),
      actionTriggered,
      tripStatus: state.tripStatus,
      automatedPing,
      contextAwareRouting,
      timestamp: now,
    };
  }

  /**
   * Manually resumes an auto-paused trip session.
   */
  async resumeTrip(tripId: string): Promise<boolean> {
    const state = this.tripStateMap.get(tripId);
    if (state) {
      state.isAutoPaused = false;
      state.tripStatus = 'active';
      state.stillStartedAt = null;
      state.hasTriggeredInactivityAlert = false;
    }
    await this.updateSessionStatus(tripId, 'active');
    logger.info(`Trip ${tripId} manually resumed.`);
    return true;
  }

  /**
   * Gets current motion tracking state for a trip.
   */
  getTripMotionState(tripId: string): TripMotionState | null {
    return this.tripStateMap.get(tripId) || null;
  }

  /**
   * Updates MongoDB NavigationSession document status.
   */
  private async updateSessionStatus(sessionId: string, status: 'active' | 'paused'): Promise<void> {
    try {
      if (mongoose.connection?.readyState === 1) {
        await NavigationSession.updateOne({ sessionId }, { $set: { status, updatedAt: new Date() } });
      }
    } catch (e: any) {
      logger.debug(`Session status update skipped: ${e.message}`);
    }
  }

  /**
   * Cleans up trip activity memory when completed.
   */
  clearTrip(tripId: string): void {
    this.tripStateMap.delete(tripId);
  }
}

export const activityRecognitionService = new ActivityRecognitionService();
