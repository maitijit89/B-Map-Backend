import { Router } from 'express';
import { carNavigationController } from './car-navigation.controller';

const router = Router();

// Multi-strategy car routing with comparison matrix
router.post('/plan', (req, res) => carNavigationController.planCarRoute(req, res));

// Multi-stop waypoint TSP optimization
router.post('/optimize-stops', (req, res) => carNavigationController.optimizeMultiStop(req, res));

// Speed camera alerts
router.get('/cameras/nearby', (req, res) => carNavigationController.getNearbyCameras(req, res));

export default router;
