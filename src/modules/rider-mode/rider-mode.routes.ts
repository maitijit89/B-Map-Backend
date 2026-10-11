import { Router } from 'express';
import { riderModeController } from './rider-mode.controller';

const router = Router();

// Specialized motorcycle/two-wheeler route planning
router.post('/route/plan', (req, res) => riderModeController.planRiderRoute(req, res));

// Real-time IMU lean angle dynamics & cornering advisory
router.post('/dynamics', (req, res) => riderModeController.processDynamics(req, res));

// Weather, wind & crosswind safety warnings
router.post('/weather-safety', (req, res) => riderModeController.evaluateWeatherSafety(req, res));

// Ultra-concise Bluetooth helmet audio cues
router.post('/helmet/cue', (req, res) => riderModeController.generateHelmetCue(req, res));

// Glove-friendly UI configuration
router.get('/glove-ui', (req, res) => riderModeController.getGloveUILayout(req, res));

// Crash detection (e-Call) & cancellation
router.post('/crash/detect', (req, res) => riderModeController.evaluateCrashTrigger(req, res));
router.post('/crash/cancel/:eventId', (req, res) => riderModeController.cancelCrashAlert(req, res));

// Crowdsourced two-wheeler hazards
router.get('/hazards/nearby', (req, res) => riderModeController.getNearbyHazards(req, res));
router.post('/hazards/report', (req, res) => riderModeController.reportHazard(req, res));

export default router;
