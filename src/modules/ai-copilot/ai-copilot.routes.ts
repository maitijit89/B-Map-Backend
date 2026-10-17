import { Router } from 'express';
import { aiCopilotController } from './ai-copilot.controller';

const router = Router();

// In-Drive Conversational Copilot Chat
router.post('/chat', (req, res) => aiCopilotController.chatPrompt(req, res));
router.get('/conversations/:conversationId', (req, res) => aiCopilotController.getConversation(req, res));

// Multimodal Vision AI scene analyzer
router.post('/vision/analyze', (req, res) => aiCopilotController.analyzeVisionScene(req, res));
router.get('/vision/incidents/nearby', (req, res) => aiCopilotController.getNearbyVisionIncidents(req, res));

// Predictive traffic & optimal departure forecasting
router.post('/traffic/forecast', (req, res) => aiCopilotController.forecastTraffic(req, res));

// POI Review Intelligence & Arrival Briefing
router.get('/poi/intelligence', (req, res) => aiCopilotController.getPOIIntelligence(req, res));

// AI Ecosystem Health & Diagnostics (Server URL: http://localhost:3000, WS: ws://localhost:3000, Gemma: http://127.0.0.1:5005)
router.get('/health', (req, res) => aiCopilotController.getAIStatus(req, res));
router.get('/status', (req, res) => aiCopilotController.getAIStatus(req, res));
router.get('/model/status', (req, res) => aiCopilotController.getGemmaModelStatus(req, res));
router.post('/model/start', (req, res) => aiCopilotController.startGemmaModel(req, res));

export default router;

