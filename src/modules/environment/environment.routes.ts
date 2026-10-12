import { Router } from 'express';
import { environmentController } from './environment.controller';

const router = Router();

router.get('/air-quality', (req, res) => environmentController.getAirQuality(req, res));
router.get('/solar', (req, res) => environmentController.getSolar(req, res));
router.get('/pollen', (req, res) => environmentController.getPollen(req, res));

export default router;
