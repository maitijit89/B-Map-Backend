import { Router } from 'express';
import { parkingNavigationController } from './parking-navigation.controller';

const router = Router();

// Outdoor-to-indoor transition detection
router.post('/entrance/detect', (req, res) => parkingNavigationController.detectEntrance(req, res));

// Facility & Bay queries
router.get('/facilities/:facilityId', (req, res) => parkingNavigationController.getFacility(req, res));
router.get('/facilities/:facilityId/bays', (req, res) => parkingNavigationController.searchBays(req, res));

// Indoor Turn-by-Turn bay routing
router.post('/indoor/plan', (req, res) => parkingNavigationController.planIndoorRoute(req, res));

// "Find My Car" reverse pedestrian navigation
router.post('/find-my-car', (req, res) => parkingNavigationController.planFindMyCar(req, res));

// Bay reservation, check-in, and billing check-out
router.post('/reserve', (req, res) => parkingNavigationController.reserveBay(req, res));
router.post('/check-in', (req, res) => parkingNavigationController.checkInBay(req, res));
router.post('/check-out', (req, res) => parkingNavigationController.checkOutBay(req, res));

export default router;
