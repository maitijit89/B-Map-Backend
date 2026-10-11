import { Router } from 'express';
import { routeController } from './route.controller';

const router = Router();

router.get('/directions', (req, res) => routeController.getDirections(req, res));
router.post('/optimize', (req, res) => routeController.optimizeTrip(req, res));
router.post('/match', (req, res) => routeController.matchTrace(req, res));
router.get('/matrix', (req, res) => routeController.getDistanceMatrix(req, res));

export default router;
