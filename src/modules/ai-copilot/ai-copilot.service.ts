import crypto from 'crypto';
import mongoose from 'mongoose';
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

export class AICopilotService {
  private activeConversations = new Map<
    string,
    {
      conversationId: string;
      userId?: string;
      vehicleContext?: AICopilotVehicleContext;
      messages: AICopilotMessage[];
    }
  >();

  /**
   * Processes a natural language voice or text prompt from the driver/rider,
   * classifies intent, executes relevant navigation tools, and generates an AI reply
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

    // 1. Natural Language Intent Classification
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
    if (mongoose.connection.readyState === 1) {
      try {
        await AICopilotSessionModel.findOneAndUpdate(
          { conversationId: convId },
          {
            conversationId: convId,
            userId: params.userId,
            vehicleContext: session.vehicleContext,
            messages: session.messages,
          },
          { upsert: true, returnDocument: 'after' }
        );
      } catch (e: any) {
        logger.warn(`Could not persist Copilot session to Mongo: ${e.message}`);
      }
    }


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
