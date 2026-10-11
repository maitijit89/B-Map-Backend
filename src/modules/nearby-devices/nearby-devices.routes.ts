import { Router } from 'express';
import { nearbyDevicesController } from './nearby-devices.controller';

const router = Router();

// =============================================================================
// BLUETOOTH / NEARBY DEVICES REST ROUTES
// =============================================================================

/**
 * 1. Client Bluetooth Permission Verification
 * Checks BLUETOOTH_SCAN, BLUETOOTH_CONNECT (Android) or Bluetooth Sharing (iOS)
 */
router.post('/permissions/verify', (req, res) =>
  nearbyDevicesController.verifyBluetoothPermissions(req, res)
);

/**
 * 2. Indoor Beacon Translation Engine
 * Translates scanned BLE beacons into exact indoor X/Y coordinates in weak-signal spaces
 */
router.post('/beacons/translate', (req, res) =>
  nearbyDevicesController.translateScannedBeacons(req, res)
);

/**
 * 3. Indoor Mapping Database Queries
 */
router.get('/beacons', (req, res) => nearbyDevicesController.listIndoorBeacons(req, res));
router.get('/beacons/:beaconId', (req, res) =>
  nearbyDevicesController.getIndoorBeaconById(req, res)
);

/**
 * 4. Beacon Calibration / Registration
 */
router.post('/beacons', (req, res) => nearbyDevicesController.registerIndoorBeacon(req, res));

export default router;
