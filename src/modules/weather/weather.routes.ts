import { Router } from 'express';
import { weatherController } from './weather.controller';

const router = Router();

router.get('/highway', (req, res) => weatherController.getHighwayWeather(req, res));
router.get('/overrides', (req, res) => weatherController.getOverrides(req, res));
router.post('/override', (req, res) => weatherController.setOverride(req, res));
router.delete('/override/:name', (req, res) => weatherController.deleteOverride(req, res));

export default router;
