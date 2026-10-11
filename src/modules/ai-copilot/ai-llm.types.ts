import { Coordinate } from '../../core/types/geo.types';

// ==========================================
// 1. AI Navigation Copilot & Conversational Agent
// ==========================================

export type AICopilotIntent =
  | 'FIND_ALONG_ROUTE'
  | 'REROUTE_TRAFFIC_WEATHER'
  | 'FATIGUE_REST_ASSIST'
  | 'QUERY_PARKING_LAST_METER'
  | 'NAV_CONTROL'
  | 'POI_DETAILS_INQUIRY'
  | 'GENERAL_TRAVEL_QNA'
  | 'UNKNOWN';

export interface AICopilotMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCall?: {
    toolName: string;
    args: Record<string, any>;
    result?: Record<string, any>;
  };
}

export interface AICopilotVehicleContext {
  currentCoordinates: Coordinate;
  speedKmh?: number;
  activeRouteId?: string;
  destinationCoordinates?: Coordinate;
  destinationName?: string;
  remainingDistanceMeters?: number;
  batteryOrFuelPercent?: number;
  weatherCondition?: string;
}

export interface AICopilotResponse {
  conversationId: string;
  assistantReply: string;
  detectedIntent: AICopilotIntent;
  confidenceScore: number;
  toolExecuted?: {
    toolName: string;
    actionTaken: string;
    data: any;
  };
  navigationActionRequired?: {
    actionType: 'add_waypoint' | 'switch_route' | 'mute' | 'adjust_hud' | 'reserve_parking';
    payload: any;
  };
  suggestions: string[];
}

// ==========================================
// 2. Multimodal Vision AI & Road Scene Analyzer
// ==========================================

export type RoadHazardVisualType =
  | 'pothole_crater'
  | 'flooding_waterlogging'
  | 'construction_barricade'
  | 'fallen_tree_debris'
  | 'disabled_vehicle_shoulder'
  | 'damaged_guardrail';

export interface DetectedVisualHazard {
  hazardType: RoadHazardVisualType;
  confidence: number; // 0..1
  boundingBoxPercent: { x: number; y: number; width: number; height: number };
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface DetectedTrafficSign {
  signType: 'speed_limit' | 'no_entry' | 'yield' | 'stop' | 'curve_ahead' | 'construction';
  recognizedValue?: string; // e.g. "30 km/h"
  confidence: number;
}

export interface VisionAnalysisResult {
  analysisId: string;
  timestamp: number;
  location?: Coordinate;
  hazardsDetected: DetectedVisualHazard[];
  trafficSignsDetected: DetectedTrafficSign[];
  parkingLotOccupancyEstimated?: {
    totalSpacesEstimated: number;
    occupiedSpacesEstimated: number;
    vacantSpacesEstimated: number;
    occupancyPercent: number;
  };
  sceneSummary: string;
  recommendedAction?: string;
}

// ==========================================
// 3. AI Predictive Traffic & Departure Optimizer
// ==========================================

export interface PredictiveDepartureOption {
  departureTime: string; // HH:MM
  departureEpoch: number;
  estimatedDurationMinutes: number;
  durationDeltaVsBaselineMinutes: number;
  congestionProbabilityPercent: number;
  confidenceScore: number;
  recommendationTag?: 'RECOMMENDED_FASTEST' | 'AVOID_PEAK_JAM' | 'BASELINE';
}

export interface PredictiveTrafficForecast {
  routeSummary: string;
  origin: Coordinate;
  destination: Coordinate;
  plannedDate: string; // YYYY-MM-DD
  baselineDurationMinutes: number;
  departureOptions: PredictiveDepartureOption[];
  bottleneckCorridors: {
    roadName: string;
    peakJamHour: string;
    historicalDelayMinutes: number;
  }[];
  aiAdvice: string;
}

// ==========================================
// 4. AI POI Intelligence & Review Synthesis
// ==========================================

export interface POIIntelligenceSummary {
  poiId: string;
  poiName: string;
  category: string;
  overallSentimentScore: number; // 0..100
  totalReviewsAnalyzed: number;
  pros: string[];
  cons: string[];
  peakCrowdHours: string;
  parkingDifficulty: 'easy' | 'moderate' | 'difficult';
  evChargerAvailabilityNote?: string;
  destinationArrivalBriefing: string;
}
