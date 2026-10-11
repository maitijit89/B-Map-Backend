import { Router } from 'express';
import { srNavigationController } from './sr-navigation.controller';

const router = Router();

// SR Sub-meter Reality HUD state calculation
router.post('/hud-state', (req, res) => srNavigationController.computeSRHUDState(req, res));

// HD Road Model registration and retrieval
router.post('/roads', (req, res) => srNavigationController.registerSRRoad(req, res));
router.get('/roads/:segmentId', (req, res) => srNavigationController.getSRRoad(req, res));

export default router;
