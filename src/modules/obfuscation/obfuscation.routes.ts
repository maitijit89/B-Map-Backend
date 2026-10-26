import { Router } from 'express';
import { obfuscationController } from './obfuscation.controller';

const router = Router();

router.post('/transform', (req, res) => obfuscationController.transform(req, res));
router.post('/fuzz', (req, res) => obfuscationController.fuzz(req, res));
router.post('/defense-mask', (req, res) => obfuscationController.defenseMask(req, res));
router.get('/defense-zones', (req, res) => obfuscationController.getDefenseZones(req, res));

export default router;
