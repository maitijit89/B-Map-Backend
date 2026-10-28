import { Router } from 'express';
import { telemetryController } from './telemetry.controller';

const router = Router();

/**
 * High-Throughput Telemetry Ingestion Pipeline Endpoints
 */

// 1. Unified Ingestion (Single Event, Array, or Batch Envelope)
router.post('/ingest', (req, res) => telemetryController.ingest(req, res));

// 2. Client Buffered Batch Endpoint (flushed every 30-60s or on background transition)
router.post('/batch', (req, res) => telemetryController.ingestBatch(req, res));

// 3. Heartbeat Ingestion Endpoint (minute heartbeats)
router.post('/heartbeat', (req, res) => telemetryController.ingestHeartbeat(req, res));

// 4. Analytics & Operational Stats
router.get('/stats', (req, res) => telemetryController.getStats(req, res));

// 5. Query Persisted Telemetry Logs
router.get('/logs', (req, res) => telemetryController.queryLogs(req, res));

export default router;
