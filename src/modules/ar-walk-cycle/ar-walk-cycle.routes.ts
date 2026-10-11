import { Router } from 'express';
import { arWalkCycleController } from './ar-walk-cycle.controller';

const router = Router();

// AR 3D World Anchor HUD frame projection
router.post('/ar/hud-frame', (req, res) => arWalkCycleController.computeARHUD(req, res));

// Accessible & sheltered walk routing
router.post('/walk/plan', (req, res) => arWalkCycleController.planWalkRoute(req, res));

// Cycling routing with elevation gradient & slope profiling
router.post('/cycle/plan', (req, res) => arWalkCycleController.planCycleRoute(req, res));

// Bike infrastructure amenities
router.get('/cycle/amenities', (req, res) => arWalkCycleController.getNearbyAmenities(req, res));

export default router;
