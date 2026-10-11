import { Router } from 'express';
import { unifiedEngineController } from './unified-engine.controller';

const router = Router();

router.post('/session/start', unifiedEngineController.startSession);
router.post('/tick', unifiedEngineController.processTick);
router.post('/recommendations/accept', unifiedEngineController.acceptRecommendation);
router.post('/recommendations/dismiss', unifiedEngineController.dismissRecommendation);

export default router;
