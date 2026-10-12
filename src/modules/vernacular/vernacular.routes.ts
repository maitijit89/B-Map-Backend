import { Router } from 'express';
import { vernacularController } from './vernacular.controller';

const router = Router();

router.post('/prompt', (req, res) => vernacularController.translatePrompt(req, res));
router.get('/languages', (req, res) => vernacularController.getLanguages(req, res));

export default router;
