import { Router } from 'express';
import { boundaryController } from './boundaries.controller';

const router = Router();

router.get('/territorial', (req, res) => boundaryController.getTerritorial(req, res));
router.get('/region-highlight', (req, res) => boundaryController.getRegionHighlight(req, res));

export default router;
