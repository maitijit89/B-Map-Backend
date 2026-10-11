import { Router } from 'express';
import { positioningController } from './positioning.controller';

const router = Router();

router.post('/fuse', positioningController.fusePosition);
router.post('/anchors', positioningController.registerAnchor);
router.get('/anchors/nearby', positioningController.getNearbyAnchors);
router.post('/rtk/base-station', positioningController.registerBaseStation);

export default router;
