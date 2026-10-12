import { Router } from 'express';
import { navicController } from './navic.controller';

const router = Router();

router.post('/fix', (req, res) => navicController.processFix(req, res));
router.get('/constellation', (req, res) => navicController.getConstellation(req, res));

export default router;
