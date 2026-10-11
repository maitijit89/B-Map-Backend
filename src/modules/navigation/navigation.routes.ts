import { Router } from 'express';
import { navigationController } from './navigation.controller';

const router = Router();

router.post('/start', (req, res) => navigationController.startNavigation(req, res));
router.post('/progress', (req, res) => navigationController.updateProgress(req, res));
router.get('/:sessionId', (req, res) => navigationController.getStatus(req, res));
router.post('/:sessionId/end', (req, res) => navigationController.endNavigation(req, res));

export default router;
