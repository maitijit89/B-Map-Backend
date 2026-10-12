import { Router } from 'express';
import { hazardController } from './hazards.controller';

const router = Router();

router.get('/ahead', (req, res) => hazardController.getAheadHazards(req, res));
router.post('/report', (req, res) => hazardController.reportHazard(req, res));

export default router;
