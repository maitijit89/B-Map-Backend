import { Router } from 'express';
import { fleetController } from './fleet.controller';

const router = Router();

router.post('/location', (req, res) => fleetController.updateLocation(req, res));
router.get('/nearby', (req, res) => fleetController.getNearby(req, res));
router.post('/trips/request', (req, res) => fleetController.requestTrip(req, res));

export default router;
