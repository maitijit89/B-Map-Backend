import { Router } from 'express';
import { digipinController } from './digipin.controller';

const router = Router();

router.get('/encode', (req, res) => digipinController.encode(req, res));
router.get('/decode/:code', (req, res) => digipinController.decode(req, res));

export default router;
