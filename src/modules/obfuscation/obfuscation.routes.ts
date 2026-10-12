import { Router } from 'express';
import { obfuscationController } from './obfuscation.controller';

const router = Router();

router.post('/transform', (req, res) => obfuscationController.transform(req, res));
router.post('/fuzz', (req, res) => obfuscationController.fuzz(req, res));

export default router;
