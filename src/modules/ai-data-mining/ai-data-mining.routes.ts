import { Router } from 'express';
import { aiDataMiningController } from './ai-data-mining.controller';

const router = Router();

router.post('/trajectories/mine-staypoints', aiDataMiningController.mineStayPoints);
router.post('/poi/resolve', aiDataMiningController.resolvePois);
router.post('/road-production/detect-new-roads', aiDataMiningController.detectNewRoads);
router.post('/road-production/detect-closure', aiDataMiningController.detectClosure);
router.get('/road-production/changes', aiDataMiningController.getChanges);

export default router;
