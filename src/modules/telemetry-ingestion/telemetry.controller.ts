import { Request, Response } from 'express';
import { logger } from '../../core/config/logger';
import { sendError, sendSuccess } from '../../core/utils/api-response';
import { TelemetryModel } from './telemetry.model';
import {
  telemetryBatchEnvelopeSchema,
  telemetryHeadersSchema,
  telemetryIngestPayloadSchema,
  telemetryQuerySchema,
} from './telemetry.schema';
import { telemetryIdempotencyService } from './telemetry-idempotency.service';
import { telemetryQueueService } from './telemetry-queue.service';
import { telemetryWorkerService } from './telemetry-worker.service';
import { TelemetryEvent, TelemetryIngestResponse } from './telemetry.types';

export class TelemetryController {
  /**
   * Main High-Throughput Ingestion Endpoint (POST /ingest)
   * 1. Strictly validates schema (Zod) & parses security/routing headers
   * 2. Rejects malformed signals with 400 before touching queue or database
   * 3. Enforces idempotency using client UUID eventId/batchId
   * 4. Enqueues directly to Redis / async queue and returns HTTP 202 Accepted
   */
  public async ingest(req: Request, res: Response): Promise<void> {
    try {
      // 1. Strict Request Header Validation
      const headerResult = telemetryHeadersSchema.safeParse(req.headers);
      if (!headerResult.success) {
        sendError(res, 400, 'Invalid telemetry request headers', headerResult.error.format());
        return;
      }

      // 2. Strict Payload Validation (Zod)
      const payloadResult = telemetryIngestPayloadSchema.safeParse(req.body);
      if (!payloadResult.success) {
        sendError(
          res,
          400,
          'Malformed telemetry signal: Schema validation rejected payload',
          payloadResult.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          }))
        );
        return;
      }

      // Normalize into flat array of events
      const rawPayload = payloadResult.data;
      let events: TelemetryEvent[] = [];
      let batchId: string | undefined;

      if (Array.isArray(rawPayload)) {
        events = rawPayload;
      } else if ('events' in rawPayload && Array.isArray(rawPayload.events)) {
        batchId = rawPayload.batchId;
        events = rawPayload.events;
      } else {
        events = [rawPayload as TelemetryEvent];
      }

      // 3. Client IP Resolution (supporting reverse proxies & Cloudflare)
      const clientIp =
        (req.headers['cf-connecting-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (req.headers['x-real-ip'] as string) ||
        req.ip ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      // 4. Batch-level Idempotency Check
      if (batchId) {
        const isNewBatch = await telemetryIdempotencyService.checkAndSetBatchIdempotent(batchId);
        if (!isNewBatch) {
          logger.info(`Idempotency: duplicate batch ${batchId} ignored.`);
          res.status(200).json({
            status: 'already_processed',
            batchId,
            queuedCount: 0,
            duplicateCount: events.length,
            timestamp: new Date().toISOString(),
          } satisfies TelemetryIngestResponse);
          return;
        }
      }

      // 5. Event-level Idempotency Deduplication (Filters out retried UUID eventIds)
      const { newEvents, duplicatesCount } = await telemetryIdempotencyService.filterNewEvents(events);

      if (newEvents.length === 0) {
        res.status(200).json({
          status: 'already_processed',
          batchId,
          queuedCount: 0,
          duplicateCount: duplicatesCount,
          timestamp: new Date().toISOString(),
        } satisfies TelemetryIngestResponse);
        return;
      }

      // Attach client IP & batchId to each event
      for (const e of newEvents) {
        e.ipAddress = clientIp;
        if (batchId && !e.metrics?.batchId) {
          e.metrics = { ...e.metrics, batchId };
        }
      }

      // 6. Direct High-Throughput Asynchronous Queue Enqueue (Avoids DB choke)
      await telemetryQueueService.enqueueBatch(newEvents);

      // 7. Instant HTTP 202 Accepted Response
      res.status(202).json({
        status: 'queued',
        batchId,
        eventId: newEvents.length === 1 ? newEvents[0].eventId : undefined,
        queuedCount: newEvents.length,
        duplicateCount: duplicatesCount,
        timestamp: new Date().toISOString(),
      } satisfies TelemetryIngestResponse);
    } catch (err: any) {
      logger.error(`Telemetry ingestion error: ${err.message}`);
      sendError(res, 500, 'Failed to ingest telemetry stream', { error: err.message });
    }
  }

  /**
   * Dedicated Buffered Mobile Batch Ingestion Endpoint (POST /batch)
   * Specifically handles client batches buffered every 30-60 seconds or on background transition.
   */
  public async ingestBatch(req: Request, res: Response): Promise<void> {
    const batchResult = telemetryBatchEnvelopeSchema.safeParse(req.body);
    if (!batchResult.success) {
      sendError(
        res,
        400,
        'Invalid telemetry batch envelope format',
        batchResult.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }))
      );
      return;
    }
    return this.ingest(req, res);
  }

  /**
   * Dedicated Lightweight Heartbeat Ingestion Endpoint (POST /heartbeat)
   */
  public async ingestHeartbeat(req: Request, res: Response): Promise<void> {
    return this.ingest(req, res);
  }

  /**
   * System Monitoring & Analytics Stats (GET /stats)
   * Exposes queue depth, consumer throughput, fraud detection rate, and open/stop session rates.
   */
  public async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const queueStats = await telemetryQueueService.getQueueStats();
      const workerStats = telemetryWorkerService.getWorkerStats();

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Telemetry Ingestion & Processing Pipeline Statistics',
        data: {
          queue: queueStats,
          worker: workerStats,
          systemTimestamp: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      sendError(res, 500, 'Failed to fetch telemetry pipeline stats', { error: err.message });
    }
  }

  /**
   * Query Stored Telemetry Records (GET /logs)
   */
  public async queryLogs(req: Request, res: Response): Promise<void> {
    try {
      const filterResult = telemetryQuerySchema.safeParse(req.query);
      if (!filterResult.success) {
        sendError(res, 400, 'Invalid query parameters', filterResult.error.format());
        return;
      }

      const { deviceId, sessionId, eventType, isFraudDetected, limit, page } = filterResult.data;
      const query: any = {};

      if (deviceId) query.deviceId = deviceId;
      if (sessionId) query.sessionId = sessionId;
      if (eventType) query.eventType = eventType;
      if (typeof isFraudDetected === 'boolean') query.isFraudDetected = isFraudDetected;

      const skip = (page - 1) * limit;

      const [total, records] = await Promise.all([
        TelemetryModel.countDocuments(query),
        TelemetryModel.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      ]);

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Telemetry query retrieved successfully',
        data: records,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err: any) {
      sendError(res, 500, 'Failed to query telemetry logs', { error: err.message });
    }
  }
}

export const telemetryController = new TelemetryController();
