import { Coordinate } from '../../core/types/geo.types';

export type PhysicalActivityType =
  | 'STILL'
  | 'WALKING'
  | 'RUNNING'
  | 'CYCLING'
  | 'DRIVING'
  | 'IN_VEHICLE'
  | 'ON_BICYCLE'
  | 'ON_FOOT'
  | 'UNKNOWN';

export type AlgorithmicActionTrigger =
  | 'NONE'
  | 'AUTO_PAUSE'
  | 'STUCK_IN_TRAFFIC_ALERT'
  | 'ARRIVAL_CONFIRMATION'
  | 'AUTO_RESUME'
  | 'MODE_SWITCH_SUGGESTION';

export interface MotionActivityPayload {
  tripId: string;
  userId: string;
  activity: PhysicalActivityType;
  confidence: number; // 0 - 100%
  coordinates?: Coordinate;
  speed?: number; // km/h or m/s
  heading?: number;
  timestamp?: number;
  permissions?: {
    activityRecognition: boolean; // Android ACTIVITY_RECOGNITION / iOS Motion & Fitness
    fineLocation?: boolean;
  };
  trafficCongestionLevel?: 'NONE' | 'MODERATE' | 'HEAVY' | 'STANDSTILL';
}

export interface AutomatedPingNotification {
  shouldNotifyClient: boolean;
  title: string;
  message: string;
  actionType: 'CHECK_TRAFFIC' | 'CONFIRM_ARRIVAL' | 'RESUME_NAVIGATION' | 'SWITCH_ROUTING_MODE' | 'INFO';
  suggestedActionPayload?: Record<string, any>;
}

export interface ContextAwareRoutingSuggestion {
  currentProfile: 'driving' | 'bike' | 'foot';
  suggestedProfile?: 'driving' | 'bike' | 'foot';
  reason?: string;
  recommendedRouteId?: string;
}

export interface MotionEvaluationResult {
  tripId: string;
  userId: string;
  currentActivity: PhysicalActivityType;
  confidence: number;
  isStill: boolean;
  stillDurationSeconds: number;
  stillThresholdSeconds: number;
  actionTriggered: AlgorithmicActionTrigger;
  tripStatus: 'active' | 'paused' | 'completed' | 'cancelled';
  automatedPing?: AutomatedPingNotification;
  contextAwareRouting?: ContextAwareRoutingSuggestion;
  timestamp: number;
}
