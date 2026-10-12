import { Router } from 'express';
import { v2xController } from './v2x.controller';

const router = Router();

router.get('/signals/nearby', (req, res) => v2xController.getNearbySignals(req, res));
router.get('/signals/:id', (req, res) => v2xController.getSignal(req, res));
router.post('/glosa/advisory', (req, res) => v2xController.calculateGLOSA(req, res));

export default router;
