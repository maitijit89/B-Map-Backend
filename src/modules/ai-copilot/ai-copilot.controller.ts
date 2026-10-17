import { Request, Response } from 'express';
import { aiCopilotService } from './ai-copilot.service';
import { aiPOIIntelligenceService } from './ai-poi-intelligence.service';
import { aiTrafficForecasterService } from './ai-traffic-forecaster.service';
import { aiVisionAnalyzerService } from './ai-vision-analyzer.service';
import { Coordinate } from '../../core/types/geo.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class AICopilotController {
  /**
   * Conversational In-Drive AI Copilot Chat & Agentic Tool Execution
   */
  async chatPrompt(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId, userId, prompt, vehicleContext } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        sendError(res, 400, 'prompt string is required');
        return;
      }

      const response = await aiCopilotService.processUserPrompt({
        conversationId,
        userId,
        prompt,
        vehicleContext,
      });

      sendSuccess({
        res,
        message: 'AI Copilot response generated successfully',
        data: response,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Retrieves conversation history
   */
  async getConversation(req: Request, res: Response): Promise<void> {
    try {
      const conversationId = req.params.conversationId as string;
      const history = await aiCopilotService.getConversationHistory(conversationId);
      if (!history) {
        sendError(res, 404, `Conversation not found: ${conversationId}`);
        return;
      }

      sendSuccess({
        res,
        message: 'Conversation history retrieved',
        data: history,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Multimodal road scene image vision analyzer
   */
  async analyzeVisionScene(req: Request, res: Response): Promise<void> {
    try {
      const { imageUrl, imageBase64, coordinates, sceneType } = req.body;

      const result = await aiVisionAnalyzerService.analyzeRoadScene({
        imageUrl,
        imageBase64,
        coordinates,
        sceneType,
      });

      sendSuccess({
        res,
        message: 'Road scene visual analysis completed',
        data: result,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Queries vision-detected hazards nearby
   */
  async getNearbyVisionIncidents(req: Request, res: Response): Promise<void> {
    try {
      const lon = parseFloat(req.query.longitude as string);
      const lat = parseFloat(req.query.latitude as string);
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 5000;

      if (isNaN(lon) || isNaN(lat)) {
        sendError(res, 400, 'Valid longitude and latitude query parameters required');
        return;
      }

      const incidents = await aiVisionAnalyzerService.getNearbyVisionIncidents([lon, lat], radius);
      sendSuccess({
        res,
        message: 'Nearby vision incidents retrieved',
        data: { count: incidents.length, incidents },
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Spatio-temporal predictive traffic and departure time optimizer
   */
  async forecastTraffic(req: Request, res: Response): Promise<void> {
    try {
      const { origin, destination, plannedDate, targetTime } = req.body;
      if (!origin || !destination) {
        sendError(res, 400, 'origin [lon, lat] and destination [lon, lat] are required');
        return;
      }

      const origCoord: Coordinate = [origin[0], origin[1]];
      const destCoord: Coordinate = [destination[0], destination[1]];

      const forecast = await aiTrafficForecasterService.forecastTripTraffic({
        origin: origCoord,
        destination: destCoord,
        plannedDate,
        targetTime,
      });

      sendSuccess({
        res,
        message: 'Predictive traffic forecast and departure recommendations generated',
        data: forecast,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * POI review intelligence synthesis and destination arrival briefing
   */
  async getPOIIntelligence(req: Request, res: Response): Promise<void> {
    try {
      const poiName = (req.query.name as string) || (req.query.id as string);
      if (!poiName) {
        sendError(res, 400, 'name or id query parameter is required');
        return;
      }

      const intelligence = await aiPOIIntelligenceService.getPOIIntelligence(poiName);
      sendSuccess({
        res,
        message: 'POI intelligence and arrival briefing generated',
        data: intelligence,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Diagnostic status of AI Backend (http://localhost:3000),
   * WebSocket Gateway (ws://localhost:3000), and Gemma Model (http://127.0.0.1:5005)
   */
  async getAIStatus(_req: Request, res: Response): Promise<void> {
    try {
      const status = await aiCopilotService.getComprehensiveAIStatus();
      sendSuccess({
        res,
        message: 'AI Ecosystem diagnostics retrieved',
        data: status,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Status of Gemma 3 1B LLM model server
   */
  async getGemmaModelStatus(_req: Request, res: Response): Promise<void> {
    try {
      const modelHealth = await aiCopilotService.checkGemmaHealth();
      sendSuccess({
        res,
        message: 'Gemma model status retrieved',
        data: modelHealth,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }

  /**
   * Triggers startup of Gemma 3 LLM model server
   */
  async startGemmaModel(_req: Request, res: Response): Promise<void> {
    try {
      const result = await aiCopilotService.startGemmaModel();
      sendSuccess({
        res,
        message: 'Gemma model start dispatched',
        data: result,
      });
    } catch (err: any) {
      sendError(res, 500, err.message);
    }
  }
}

export const aiCopilotController = new AICopilotController();

