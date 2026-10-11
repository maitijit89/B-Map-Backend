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

export default router;
