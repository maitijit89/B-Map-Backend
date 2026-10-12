import { Router } from 'express';
import { fareController } from './fares.controller';

const router = Router();

router.post('/estimate', (req, res) => fareController.estimateFares(req, res));

export default router;
