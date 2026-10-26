import { Router } from 'express';
import { appVersionController } from './app-version.controller';

const router = Router();

/**
 * 1. Client Version Verification
 * Evaluates whether an installed client needs a major release, minor upgrade, or OTA patch bundle.
 * Supports both query params (GET) and structured JSON bodies (POST).
 */
router.get('/check', (req, res) => appVersionController.checkVersion(req, res));
router.post('/check', (req, res) => appVersionController.checkVersion(req, res));

/**
 * 2. Current Sovereign Backend Version
 * Returns authoritative running server version (1.0.0).
 */
router.get('/current', (req, res) => appVersionController.getCurrent(req, res));

/**
 * 3. Latest Platform Releases
 * Returns version specifications, minimum versions, and patch bundles across web, android, ios, and desktop.
 */
router.get('/latest', (req, res) => appVersionController.getLatestPlatforms(req, res));

/**
 * 4. Dynamic Frontend Version Patch API
 * Patches version strings, force-update thresholds, release notes, and OTA patch bundle URLs.
 * Broadcasts real-time Socket.IO notifications to active clients.
 */
router.patch('/patch', (req, res) => appVersionController.patchVersion(req, res));
router.post('/patch', (req, res) => appVersionController.patchVersion(req, res));

/**
 * 5. Push Version Broadcast
 * Triggers manual WebSocket broadcast to connected frontend clients.
 */
router.post('/broadcast', (req, res) => appVersionController.broadcastUpdate(req, res));

export default router;
