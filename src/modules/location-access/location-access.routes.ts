import { Router } from 'express';
import { locationAccessController } from './location-access.controller';

const router = Router();

// Ingestion endpoint with session validation & dynamic rates (1-2s foreground vs 30-60s background)
router.post('/ingest', (req, res) => locationAccessController.ingestLocation(req, res));

// Client lifecycle mode reporting (transitioning between foreground and background)
router.post('/lifecycle-mode', (req, res) =>
  locationAccessController.reportLifecycleChange(req, res)
);

// Session activation and privacy termination endpoints
router.post('/session/register', (req, res) =>
  locationAccessController.registerActiveSession(req, res)
);
router.post('/session/:tripId/terminate', (req, res) =>
  locationAccessController.terminateSession(req, res)
);

// Strict Cryptographic Scoping: Tokenize trips and refresh short-lived JWTs
router.post('/session/tokenize-trip', (req, res) =>
  locationAccessController.tokenizeTrip(req, res)
);
router.post('/session/refresh-trip-token', (req, res) =>
  locationAccessController.refreshTripToken(req, res)
);

// Permission State Caching (Redis & Memory Map): Revocation and status querying
router.post('/permissions/revoke', (req, res) =>
  locationAccessController.revokeBackgroundPermissions(req, res)
);
router.get('/permissions/:userId', (req, res) =>
  locationAccessController.getPermissionState(req, res)
);
router.put('/permissions/state', (req, res) =>
  locationAccessController.updatePermissionState(req, res)
);

export default router;
