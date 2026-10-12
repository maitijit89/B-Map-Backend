import { Router } from 'express';
import { timezoneController } from './timezone.controller';

const router = Router();

router.get('/', (req, res) => timezoneController.getTimeZone(req, res));

export default router;
