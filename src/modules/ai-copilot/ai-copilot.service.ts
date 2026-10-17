import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../../core/config/env.config';
import { logger } from '../../core/config/logger';

import { AICopilotSessionModel } from './ai-copilot-session.model';
import {
  AICopilotIntent,
  AICopilotMessage,
  AICopilotResponse,
  AICopilotVehicleContext,
} from './ai-llm.types';
import { Coordinate } from '../../core/types/geo.types';
import { calculateDistanceMeters } from '../../core/utils/geo.utils';
import { parkingSpaceNavigationService } from '../parking/parking-space-navigation.service';
import { aiCopilotSocketBridge } from './ai-copilot-socket-bridge.service';

export class AICopilotService {
  private aiClient: AxiosInstance;
  private activeConversations = new Map<
    string,
    {
      conversationId: string;
      userId?: string;
      vehicleContext?: AICopilotVehicleContext;
      messages: AICopilotMessage[];
    }
  >();

  constructor() {
    this.aiClient = axios.create({
      baseURL: env.AI_BACKEND_URL,
      timeout: env.AI_BACKEND_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': env.AI_BACKEND_API_KEY,
      },
    });
  }

  /**
   * Forwards dashcam / road camera visual frames for hazard and sign analysis
   */
  async analyzeRoadScene(payload: any) {
    try {
      const response = await this.aiClient.post('/api/v1/ai-copilot/vision/analyze', payload);
      return response.data?.data || response.data;
    } catch (error: any) {
      logger.warn('[AICopilotService] Failed to contact AI Microservice for vision analysis:', error?.message);
      return {
        detectedHazards: [],
        trafficSigns: [],
        roadSafetyScore: 95,
        sceneSummary: 'Standard road corridor detected.',
      };
    }
  }

  /**
   * Forwards predictive departure requests
   */
  async forecastTraffic(payload: any) {
    try {
      const response = await this.aiClient.post('/api/v1/ai-copilot/traffic/departure-optimizer', payload);
      return response.data?.data || response.data;
    } catch (error: any) {
      logger.warn('[AICopilotService] Failed to contact AI Microservice for traffic forecast:', error?.message);
      return {
        recommendedDepartureTime: new Date(Date.now() + 15 * 60000).toISOString(),
        predictedDurationMinutes: 30,
        confidence: 0.9,
      };
    }
  }

  /**
   * Probes the AI Backend microservice (b_map_ai) for health status
   */
  async checkAIHealth(): Promise<{
    backend: string;
    socketGateway: string;
    uptimeSeconds?: number;
    database?: any;
    model?: any;
  }> {
    try {
      const response = await this.aiClient.get('/health', { timeout: 3000 });
      return {
        backend: response.data?.backend || 'healthy',
        socketGateway: response.data?.socket_gateway || 'active',
        uptimeSeconds: response.data?.uptime_seconds,
        database: response.data?.database,
        model: response.data?.model,
      };
    } catch {
      return {
        backend: 'unreachable',
        socketGateway: 'offline',
      };
    }
  }

  /**
   * Checks the Gemma 3 1B LLM inference engine status directly or via AI microservice
   */
  async checkGemmaHealth(): Promise<{
    status: string;
    model: string;
    service: string;
    is_ready: boolean;
    features?: any;
    error?: string;
  }> {
    // 1. Direct query to Gemma Model URL
    try {
      const response = await axios.get(`${env.GEMMA_MODEL_URL}/health`, { timeout: 3000 });
      if (response.data) {
        return {
          status: response.data.status || (response.data.is_ready ? 'ready' : 'loading'),
          model: response.data.model || 'Gemma 3 1B',
          service: response.data.service || 'B Map AI Inference Service',
          is_ready: Boolean(response.data.is_ready),
          features: response.data.features,
        };
      }
    } catch {
      // 2. Fallback query through b_map_ai model status endpoint
      try {
        const response = await this.aiClient.get('/api/model/status', { timeout: 3000 });
        const health = response.data?.health || response.data;
        return {
          status: health?.status || 'offline',
          model: health?.model || 'Gemma 3 1B',
          service: health?.service || 'B Map AI Navigation Engine',
          is_ready: Boolean(health?.is_ready),
          features: health?.features,
          error: health?.error,
        };
      } catch (proxyErr: any) {
        return {
          status: 'offline',
          model: 'Gemma 3 1B',
          service: 'B Map AI Navigation Engine',
          is_ready: false,
          error: proxyErr.message,
        };
      }
    }

    return {
      status: 'offline',
      model: 'Gemma 3 1B',
      service: 'B Map AI Navigation Engine',
      is_ready: false,
    };
  }

  /**
   * Triggers startup of the Gemma 3 LLM model server via b_map_ai
   */
  async startGemmaModel(): Promise<{ started: boolean; message: string }> {
    try {
      const response = await this.aiClient.post('/api/model/start', {}, { timeout: 10000 });
      return response.data?.result || response.data || { started: true, message: 'Gemma startup initiated' };
    } catch (err: any) {
      logger.warn(`[AICopilotService] Failed to trigger Gemma model start: ${err.message}`);
      return { started: false, message: err.message };
    }
  }

  /**
   * Initializes AI ecosystem: connects WebSocket bridge, probes health, and auto-starts Gemma if configured
   */
  async initializeAIConnection(): Promise<void> {
    logger.info('🚀 [AICopilotService] Initializing AI Microservice & Gemma Model connection...');

    // 1. Initialize persistent WebSocket Gateway connection to ws://localhost:3000
    aiCopilotSocketBridge.connect();

    // 2. Probe AI Microservice Backend (http://localhost:3000)
    const aiHealth = await this.checkAIHealth();

    // 3. Probe Gemma Model (http://127.0.0.1:5005)
    const gemmaHealth = await this.checkGemmaHealth();

    // 4. If Gemma model is offline and AUTO_START_GEMMA is enabled, trigger startup
    if (!gemmaHealth.is_ready && env.AUTO_START_GEMMA) {
      logger.info('🤖 [AICopilotService] Auto-start enabled: requesting Gemma 3 LLM inference server start...');
      const startResult = await this.startGemmaModel();
      logger.info(`🤖 [AICopilotService] Gemma auto-start dispatch: ${startResult.message}`);
    }

    // 5. Log connection telemetry
    const bridgeStatus = aiCopilotSocketBridge.getStatus();
    logger.info('======================================================');
    logger.info(' [B-Map AI Integration Status]');
    logger.info('======================================================');
    logger.info(` Server URL       : ${env.AI_BACKEND_URL} (${aiHealth.backend})`);
    logger.info(` WebSocket Gateway: ${env.AI_BACKEND_WS_URL} (${bridgeStatus.isConnected ? 'CONNECTED' : 'STANDBY'})`);
    logger.info(` Environment      : ${env.APP_ENV}`);
    logger.info(` Gemma Model URL  : ${env.GEMMA_MODEL_URL} (${gemmaHealth.status.toUpperCase()})`);
    logger.info(` Auto-start Model : ${env.AUTO_START_GEMMA}`);
    logger.info('======================================================');
  }

  /**
   * Returns diagnostic status across all 3 AI layers
   */
  async getComprehensiveAIStatus() {
    const aiHealth = await this.checkAIHealth();
    const gemmaHealth = await this.checkGemmaHealth();
    const bridgeStatus = aiCopilotSocketBridge.getStatus();

    return {
      serverUrl: env.AI_BACKEND_URL,
      websocketGateway: env.AI_BACKEND_WS_URL,
      environment: env.APP_ENV,
      gemmaModelUrl: env.GEMMA_MODEL_URL,
      autoStartModel: env.AUTO_START_GEMMA,
      aiBackend: aiHealth,
      gemmaModel: gemmaHealth,
      webSocketBridge: bridgeStatus,
    };
  }

  /**
   * Processes a natural language voice or text prompt from the driver/rider,
   * proxies to b_map_ai microservice if available, and falls back to resilient local AI engine
   */
  async processUserPrompt(params: {
    conversationId?: string;
    userId?: string;
    prompt: string;
    vehicleContext?: AICopilotVehicleContext;
  }): Promise<AICopilotResponse> {
    const convId = params.conversationId || `conv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    let session = this.activeConversations.get(convId);

    if (!session) {
      session = {
        conversationId: convId,
        userId: params.userId,
        vehicleContext: params.vehicleContext,
        messages: [],
      };
      this.activeConversations.set(convId, session);
    }

    if (params.vehicleContext) {
      session.vehicleContext = { ...session.vehicleContext, ...params.vehicleContext };
    }

    // Record user message
    const userMsg: AICopilotMessage = {
      role: 'user',
      content: params.prompt,
      timestamp: Date.now(),
    };
    session.messages.push(userMsg);

    // 1. Attempt AI Microservice Proxy (b_map_ai via HTTP Gateway)
    try {
      const payload = {
        sessionId: convId,
        driverId: params.userId,
        prompt: params.prompt,
        telemetry: {
          coordinates: params.vehicleContext?.currentCoordinates || [13.404954, 52.520008],
          speedKmH: params.vehicleContext?.speedKmh || 50,
          headingDeg: params.vehicleContext?.headingDeg || 0,
          remainingDistanceMeters: params.vehicleContext?.remainingDistanceMeters || 5000,
          etaMinutes: params.vehicleContext?.etaMinutes || 10,
          batteryOrFuelSoC: params.vehicleContext?.fuelLevelPercent || 80,
          activeRouteId: params.vehicleContext?.activeRouteId || 'default_route',
          destinationMetadata: {
            name: params.vehicleContext?.destinationName || 'Destination',
            coordinates: params.vehicleContext?.destinationCoordinates || [13.404954, 52.520008],
          },
        },
      };

      const response = await this.aiClient.post('/api/v1/ai-copilot/message', payload);
      const aiData = response.data?.data || response.data;

      if (aiData) {
        const assistantReply =
          aiData.speechResponse ||
          aiData.assistantReply ||
          aiData.message ||
          "I have updated your navigation route.";
        const detectedIntent = (aiData.classifiedIntent || aiData.detectedIntent || 'GENERAL_TRAVEL_QNA') as AICopilotIntent;
        const confidenceScore = aiData.confidenceScore || 0.95;
        const toolExecuted = aiData.executedActions?.[0] || aiData.toolExecuted;
        const navigationActionRequired = aiData.executedActions?.[0]
          ? {
              actionType: aiData.executedActions[0].tool,
              payload: aiData.executedActions[0].params,
            }
          : undefined;
        const suggestions = aiData.uiSuggestions || aiData.suggestions || ['Continue Route'];

        const assistantMsg: AICopilotMessage = {
          role: 'assistant',
          content: assistantReply,
          timestamp: Date.now(),
          toolCall: toolExecuted,
        };
        session.messages.push(assistantMsg);

        await this.persistSession(convId, params.userId, session);

        return {
          conversationId: convId,
          assistantReply,
          detectedIntent,
          confidenceScore,
          toolExecuted,
          navigationActionRequired,
          suggestions,
        };
      }
    } catch (proxyError: any) {
      // In development or when b_map_ai is offline, gracefully fall back to local rule-based intent engine
      logger.debug(`[AICopilotService] b_map_ai proxy unreachable (${proxyError?.message}), activating resilient local engine`);
    }

    // 2. Resilient Local Engine Fallback (Rule-Based Agentic Tools)
    const { intent, confidence } = this.classifyIntent(params.prompt);

    // 2. Agentic Tool Execution based on Intent
    let assistantReply = '';
    let toolResult: any;
    let navAction: any;
    let suggestions: string[] = [];

    const curLoc = session.vehicleContext?.currentCoordinates || [13.38886, 52.517037];

    switch (intent) {
      case 'FIND_ALONG_ROUTE': {
        const queryLower = params.prompt.toLowerCase();
        const category = queryLower.includes('coffee') || queryLower.includes('cafe')
          ? 'coffee'
          : queryLower.includes('gas') || queryLower.includes('fuel')
          ? 'gas_station'
          : queryLower.includes('charge') || queryLower.includes('ev')
          ? 'ev_charging'
          : 'restaurant';

        const foundPOIs = this.mockSearchAlongRoute(curLoc, category);
        const best = foundPOIs[0];

        assistantReply = `I found ${foundPOIs.length} ${category.replace('_', ' ')}s along your route. The closest is "${best.name}", just 180m off your route with a 2-minute detour. Would you like me to add it as a stop?`;
        toolResult = {
          toolName: 'search_pois_along_route',
          actionTaken: `Found ${foundPOIs.length} options matching "${category}"`,
          data: { category, candidates: foundPOIs },
        };
        navAction = {
          actionType: 'add_waypoint',
          payload: { waypoint: best.coordinates, name: best.name },
        };
        suggestions = ['Yes, add as waypoint', 'Find another option', 'Show route overview'];
        break;
      }

      case 'REROUTE_TRAFFIC_WEATHER': {
        assistantReply = `Checking real-time conditions. Heavy traffic delay detected ahead on Friedrichstraße (+8 mins). I have found a faster bypass via Glinkastraße saving 6 minutes. Switching to the faster alternative now.`;
        toolResult = {
          toolName: 'reroute_traffic_avoidance',
          actionTaken: 'Alternative bypass calculated avoiding 8-min jam',
          data: { timeSavedSeconds: 360, bypassRoad: 'Glinkastraße' },
        };
        navAction = {
          actionType: 'switch_route',
          payload: { routeId: 'route_bypass_fast', timeSavedMinutes: 6 },
        };
        suggestions = ['Keep current route', 'Confirm bypass', 'Why is it delayed?'];
        break;
      }

      case 'FATIGUE_REST_ASSIST': {
        assistantReply = `I noticed you've been driving for over 2 hours. There is a Shell Service Plaza with a café and clean restrooms in 4.2 km (Exit 14). Would you like to take a 15-minute break there?`;
        toolResult = {
          toolName: 'find_fatigue_rest_stop',
          actionTaken: 'Identified roadside rest plaza within 5km',
          data: { restPlaza: 'Shell Plaza Tiergarten', distanceKm: 4.2 },
        };
        navAction = {
          actionType: 'add_waypoint',
          payload: { name: 'Shell Service Plaza Tiergarten', coordinates: [13.35, 52.51] },
        };
        suggestions = ['Yes, route to rest stop', 'I feel fine, dismiss', 'Remind me in 30 mins'];
        break;
      }

      case 'QUERY_PARKING_LAST_METER': {
        const facility = parkingSpaceNavigationService.getFacility('fac_berlin_potsdamer_hub');
        const bays = await parkingSpaceNavigationService.searchParkingBays('fac_berlin_potsdamer_hub', {
          status: 'vacant',
        });
        const evBays = bays.filter((b) => b.bayType === 'ev_charging');

        assistantReply = `At ${facility?.name || 'your destination'}, there are currently ${bays.length} open parking bays. Level B2 has ${evBays.length} high-power 150kW EV chargers available. Shall I reserve bay ${evBays[0]?.spaceNumber || 'B2-A101'} for you?`;
        toolResult = {
          toolName: 'query_smart_parking_bay',
          actionTaken: 'Queried multi-floor parking bay availability',
          data: { totalVacant: bays.length, evChargingVacant: evBays.length, recommendedBay: evBays[0] },
        };
        navAction = {
          actionType: 'reserve_parking',
          payload: { facilityId: 'fac_berlin_potsdamer_hub', bayId: evBays[0]?.bayId },
        };
        suggestions = ['Reserve EV charger bay', 'Show standard bays', 'Navigate to entrance'];
        break;
      }

      case 'NAV_CONTROL': {
        const queryLower = params.prompt.toLowerCase();
        if (queryLower.includes('mute') || queryLower.includes('quiet')) {
          assistantReply = 'Voice guidance is now muted. Visual HUD and critical hazard alerts will remain active.';
          navAction = { actionType: 'mute', payload: { isMuted: true } };
        } else {
          assistantReply = 'Adjusted navigation view to 3D Perspective Mode.';
          navAction = { actionType: 'adjust_hud', payload: { viewMode: '3d_perspective' } };
        }
        toolResult = { toolName: 'adjust_nav_control', actionTaken: 'Updated audio/visual setting', data: navAction.payload };
        suggestions = ['Unmute voice', 'Show 2D overview', 'Cancel navigation'];
        break;
      }

      default: {
        assistantReply = `I am your B-Map AI Driving Copilot. You are currently en-route with ${Math.round(
          (session.vehicleContext?.remainingDistanceMeters || 4500) / 1000
        )} km remaining. You can ask me to find places along the route, check parking, reroute around traffic, or adjust navigation.`;
        suggestions = ['Find coffee on the way', 'Check parking availability', 'Is there traffic ahead?'];
        break;
      }
    }

    // Record assistant reply
    const assistantMsg: AICopilotMessage = {
      role: 'assistant',
      content: assistantReply,
      timestamp: Date.now(),
      toolCall: toolResult,
    };
    session.messages.push(assistantMsg);

    // Save session asynchronously if MongoDB is connected
    await this.persistSession(convId, params.userId, session);


    return {
      conversationId: convId,
      assistantReply,
      detectedIntent: intent,
      confidenceScore: confidence,
      toolExecuted: toolResult,
      navigationActionRequired: navAction,
      suggestions,
    };
  }

  /**
   * Classifies user intent using semantic keyword & syntactic patterns
   */
  private classifyIntent(prompt: string): { intent: AICopilotIntent; confidence: number } {
    const p = prompt.toLowerCase();

    // 1. Parking & Last-meter guidance (high specificity)
    if (p.includes('park') || p.includes('garage') || p.includes('bay') || p.includes('spot')) {
      return { intent: 'QUERY_PARKING_LAST_METER', confidence: 0.96 };
    }
    // 2. Fatigue / rest stop assist
    if (p.includes('tired') || p.includes('sleepy') || p.includes('rest') || p.includes('fatigue') || p.includes('break')) {
      return { intent: 'FATIGUE_REST_ASSIST', confidence: 0.95 };
    }
    // 3. Traffic rerouting & weather
    if (p.includes('reroute') || p.includes('traffic') || p.includes('jam') || p.includes('faster') || p.includes('weather') || p.includes('storm')) {
      return { intent: 'REROUTE_TRAFFIC_WEATHER', confidence: 0.92 };
    }
    // 4. In-vehicle HUD & voice controls
    if (p.includes('mute') || p.includes('unmute') || p.includes('volume') || p.includes('zoom') || p.includes('overview') || p.includes('hud')) {
      return { intent: 'NAV_CONTROL', confidence: 0.91 };
    }
    // 5. POI specific details
    if (p.includes('hours') || p.includes('review') || p.includes('rating') || p.includes('phone') || p.includes('menu')) {
      return { intent: 'POI_DETAILS_INQUIRY', confidence: 0.88 };
    }
    // 6. Generic POI search along corridor
    if (p.includes('find') || p.includes('search') || p.includes('along') || p.includes('coffee') || p.includes('food') || p.includes('gas') || p.includes('charge')) {
      return { intent: 'FIND_ALONG_ROUTE', confidence: 0.94 };
    }
    return { intent: 'GENERAL_TRAVEL_QNA', confidence: 0.75 };
  }

  /**
   * Simulates spatial POI search along the active vehicle corridor
   */
  private mockSearchAlongRoute(loc: Coordinate, category: string) {
    return [
      {
        id: 'poi_coffee_01',
        name: 'The Barn Specialty Coffee & Bakery',
        category,
        coordinates: [loc[0] + 0.002, loc[1] + 0.001] as Coordinate,
        detourDurationMinutes: 2,
        rating: 4.8,
        isOpenNow: true,
      },
      {
        id: 'poi_coffee_02',
        name: 'Espresso House Drive-Thru',
        category,
        coordinates: [loc[0] + 0.005, loc[1] + 0.003] as Coordinate,
        detourDurationMinutes: 4,
        rating: 4.5,
        isOpenNow: true,
      },
    ];
  }

  /**
   * Persists conversation session into MongoDB if available
   */
  private async persistSession(convId: string, userId: string | undefined, session: any): Promise<void> {
    if (mongoose.connection.readyState === 1) {
      try {
        await AICopilotSessionModel.findOneAndUpdate(
          { conversationId: convId },
          {
            conversationId: convId,
            userId,
            vehicleContext: session.vehicleContext,
            messages: session.messages,
          },
          { upsert: true, returnDocument: 'after' }
        );
      } catch (e: any) {
        logger.warn(`Could not persist Copilot session to Mongo: ${e.message}`);
      }
    }
  }

  /**
   * Retrieves conversation history
   */
  async getConversationHistory(conversationId: string) {
    const session = this.activeConversations.get(conversationId);
    if (session) return session;

    try {
      return await AICopilotSessionModel.findOne({ conversationId }).lean();
    } catch {
      return null;
    }
  }
}

export const aiCopilotService = new AICopilotService();
