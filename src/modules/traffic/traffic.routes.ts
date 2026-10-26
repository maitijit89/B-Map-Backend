import { Router } from 'express';
import { trafficController } from './traffic.controller';

const router = Router();

// 1. Crowdsourced Telemetry: Ingest real-time anonymized velocity vectors
router.post('/telemetry', (req, res) => trafficController.ingestTelemetry(req, res));

// 2. Road Graph Weighting & Real-time ETA Calculation (travel time in MINUTES, not kilometers)
router.post('/eta', (req, res) => trafficController.calculateRealtimeEta(req, res));

// 3. Edge Cases: Multi-device clustering & outlier rejection (tea stall / single vehicle false positive filter)
router.post('/evaluate-anomaly', (req, res) => trafficController.evaluateAnomaly(req, res));

// 4. Road Graph: Directed network topology of intersections (nodes) & segments (edges weighted in minutes)
router.get('/graph', (req, res) => trafficController.getRoadGraph(req, res));

// 5. Segments: Live speeds, congestion levels, active device counts, and minutes travel time
router.get('/segments', (req, res) => trafficController.getSegments(req, res));

// 6. Traffic Prediction: Blended live + historical distributions across 15-minute time windows
router.get('/predict', (req, res) => trafficController.predictCorridorTraffic(req, res));

// 7. Individual Segment Real-time & Historical Profile
router.get('/segments/:segmentId', (req, res) => trafficController.getSegmentDetails(req, res));

// 8. Lighthill-Whitham-Richards (LWR) Shockwave Propagation & Upstream Spillback Analysis
router.get('/shockwave/:segmentId', (req, res) => trafficController.getShockwaveAnalysis(req, res));

// 9. Multi-Criteria Physics-Based Eco & Energy Consumption Routing
router.post('/eco', (req, res) => trafficController.calculateEcoRoute(req, res));

// 10. Anti-GPS Spoofing & Kinematic Plausibility Guard Verification
router.post('/security/anti-spoofing', (req, res) => trafficController.verifyTelemetrySecurity(req, res));

// 11. Cryptographic Proof-of-Presence & Geofence Attestation Generation
router.post('/security/proof-of-presence', (req, res) => trafficController.createProofOfPresence(req, res));

// 12. Proof-of-Presence Certificate Cryptographic Verification
router.post('/security/proof-of-presence/verify', (req, res) => trafficController.verifyProofOfPresenceCertificate(req, res));

export default router;
