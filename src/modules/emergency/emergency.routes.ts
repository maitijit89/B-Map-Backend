import { Router } from 'express';
import { emergencyController } from './emergency.controller';

const router = Router();

router.post('/sos', (req, res) => emergencyController.triggerSOS(req, res));
router.get('/facilities/nearby', (req, res) => emergencyController.getNearbyFacilities(req, res));

export default router;
