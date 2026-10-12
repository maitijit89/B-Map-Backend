import { Router } from 'express';
import { tollController } from './tolls.controller';

const router = Router();

router.post('/calculate', (req, res) => tollController.calculateTolls(req, res));
router.get('/nearby', (req, res) => tollController.getNearby(req, res));

export default router;
