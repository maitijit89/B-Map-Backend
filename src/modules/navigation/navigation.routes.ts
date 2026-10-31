import { Router } from 'express';
import { navigationController } from './navigation.controller';
import { arWalkCycleController } from '../ar-walk-cycle/ar-walk-cycle.controller';

const router = Router();

// AR Visual Search & Photo Geolocation
router.post('/ar-visual-search', (req, res) => arWalkCycleController.searchByPhoto(req, res));

router.post('/start', (req, res) => navigationController.startNavigation(req, res));
router.post('/progress', (req, res) => navigationController.updateProgress(req, res));
router.get('/:sessionId', (req, res) => navigationController.getStatus(req, res));
router.post('/:sessionId/end', (req, res) => navigationController.endNavigation(req, res));

export default router;
