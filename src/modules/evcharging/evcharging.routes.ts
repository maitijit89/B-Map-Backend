import { Router } from 'express';
import { evController } from './evcharging.controller';

const router = Router();

router.get('/stations', (req, res) => evController.getStations(req, res));
router.get('/stations/:id', (req, res) => evController.getStationById(req, res));

export default router;
