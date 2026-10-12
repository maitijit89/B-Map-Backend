import { Router } from 'express';
import { roadsController } from './roads.controller';

const router = Router();

router.post('/snap-to-roads', (req, res) => roadsController.snapToRoads(req, res));
router.get('/speed-limits', (req, res) => roadsController.getSpeedLimits(req, res));

export default router;
