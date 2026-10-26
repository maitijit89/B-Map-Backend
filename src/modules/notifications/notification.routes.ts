import { Router } from 'express';
import { notificationController } from './notification.controller';

const router = Router();

// ==========================================
// 1. TOKEN MANAGEMENT (APNs & FCM)
// ==========================================
router.post('/devices/register', (req, res) =>
  notificationController.registerDeviceToken(req, res)
);
router.delete('/devices/:token', (req, res) =>
  notificationController.deRegisterDeviceToken(req, res)
);
router.get('/devices/:userId', (req, res) =>
  notificationController.getUserDevices(req, res)
);

// ==========================================
// 2. TARGETED PUSH DISPATCH
// ==========================================
router.post('/send-targeted', (req, res) =>
  notificationController.sendTargetedPush(req, res)
);

// ==========================================
// 3. REAL-TIME GEOFENCE TRIGGER & ENGINE (Circular, Polygon, 500M / 100M)
// ==========================================
router.post('/geofence/evaluate', (req, res) =>
  notificationController.evaluateGeofence(req, res)
);
router.post('/geofence/register', (req, res) =>
  notificationController.registerGeofence(req, res)
);
router.get('/geofence/list', (req, res) =>
  notificationController.listGeofences(req, res)
);
router.post('/geofence/device-evaluate', (req, res) =>
  notificationController.evaluateDeviceGeofences(req, res)
);

export default router;

