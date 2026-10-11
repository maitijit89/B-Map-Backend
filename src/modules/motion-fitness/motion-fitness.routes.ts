import { Router } from 'express';
import { motionFitnessController } from './motion-fitness.controller';

const router = Router();

// Ingest physical motion activity (STILL, WALKING, DRIVING) & coordinates
router.post('/activity', (req, res) => motionFitnessController.recordActivity(req, res));

// Manually resume an auto-paused trip
router.post('/resume', (req, res) => motionFitnessController.resumeTrip(req, res));

// Query current physical activity tracking state
router.get('/trip/:tripId', (req, res) => motionFitnessController.getTripActivity(req, res));

export default router;
