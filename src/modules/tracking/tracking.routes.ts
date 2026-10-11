import { Router } from 'express';
import { trackingController } from './tracking.controller';
import { locationAccessController } from '../location-access/location-access.controller';

const router = Router();

// Legacy simple location ping
router.post('/update', (req, res) => trackingController.updateLocation(req, res));
router.get('/nearby', (req, res) => trackingController.getNearbyEntities(req, res));
router.get('/:userId', (req, res) => trackingController.getEntityLocation(req, res));

// Dynamic Ingestion & Session Privacy Validation Routes
router.post('/ingest', (req, res) => locationAccessController.ingestLocation(req, res));
router.post('/lifecycle-mode', (req, res) => locationAccessController.reportLifecycleChange(req, res));
router.post('/session/register', (req, res) => locationAccessController.registerActiveSession(req, res));
router.post('/session/:tripId/terminate', (req, res) => locationAccessController.terminateSession(req, res));

export default router;
