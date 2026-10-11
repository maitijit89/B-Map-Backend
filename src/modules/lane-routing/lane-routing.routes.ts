import { Router } from 'express';
import { laneRoutingController } from './lane-routing.controller';

const router = Router();

router.post('/guidance', laneRoutingController.getLaneGuidance);
router.post('/plan', laneRoutingController.planVeteranRoute);
router.post('/veteran/experience', laneRoutingController.reportVeteranExperience);
router.post('/segments', laneRoutingController.registerLaneSegment);

export default router;
