import { Router } from 'express';
import { automotiveController } from './automotive.controller';

const router = Router();

// Apple CarPlay & Android Auto projection templates
router.post('/carplay/template', (req, res) => automotiveController.getCarPlayTemplate(req, res));
router.post('/android-auto/template', (req, res) => automotiveController.getAndroidAutoTemplate(req, res));

// AAOS CarPropertyManager / VHAL
router.post('/aaos/properties', (req, res) => automotiveController.updateAAOSProperties(req, res));

// CAN Bus / OBD-II telemetry & Eco-Driving scoring
router.post('/telemetry/can', (req, res) => automotiveController.ingestCANTelemetry(req, res));

// EV Range planning & Smart Charging stops
router.post('/ev/plan', (req, res) => automotiveController.planEVRoute(req, res));

// Smart Optical Heads-Up Display (HUD) binary protocol
router.post('/hud/frame', (req, res) => automotiveController.getHUDFrame(req, res));

export default router;
