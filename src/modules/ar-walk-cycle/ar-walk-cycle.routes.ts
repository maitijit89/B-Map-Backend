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

// Multimodal AI Visual Localization from Photo & AR Navigation Search
router.post('/visual-search', (req, res) => arWalkCycleController.searchByPhoto(req, res));

// Interactive Glassmorphic Web UI for AR Visual Navigation
router.get('/visual-search/view', (req, res) => arWalkCycleController.getVisualSearchView(req, res));
router.get('/view', (req, res) => arWalkCycleController.getVisualSearchView(req, res));

export default router;
