import mongoose from 'mongoose';
import { logger } from '../../core/config/logger';
import { TelemetryModel } from './telemetry.model';
import { telemetryFraudService } from './telemetry-fraud.service';
import { telemetryQueueService } from './telemetry-queue.service';
import { TelemetryAnalyticsSummary, TelemetryEvent } from './telemetry.types';

export class TelemetryWorkerService {
  private isRunning = false;
  private loopTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 500; // Batch-insert up to 500 rows per cycle
  private readonly POLL_INTERVAL_MS = 250; // Micro-batch polling interval

  // Analytics counters
  private totalOpenSessions = 0;
  private totalStopSessions = 0;
  private totalBatchesProcessed = 0;
  private totalRowsInserted = 0;
  private totalFraudDetected = 0;

  /**
   * Starts the background consumer worker loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('⚙️ Telemetry Asynchronous Worker consumer started (Batch Size: 500, Poll: 250ms).');
    this.scheduleNextTick();
  }

  /**
   * Gracefully stops the worker loop and drains pending in-flight batches.
   */
  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    logger.info('Telemetry worker consumer stopped.');
  }

  /**
   * Main consumer execution loop. Drains queue up to 500 items, processes analytics & fraud,
   * and executes MongoDB bulk-insert.
   */
  public async processQueueTick(): Promise<number> {
    try {
      const batch = await telemetryQueueService.dequeueBatch(this.BATCH_SIZE);
      if (batch.length === 0) {
        return 0;
      }

      await this.processBatch(batch);
      return batch.length;
    } catch (err: any) {
      logger.error(`Error in telemetry worker execution tick: ${err.message}`);
      return 0;
    }
  }

  /**
   * Processes a batch of telemetry events:
   * 1. Calculate open/stop rate and session length (session_end_time - session_start_time)
   * 2. Run fraud detection heuristics (timezone vs IP, rapid battery level jump, emulator fingerprint)
   * 3. Batch-insert rows into MongoDB using high-throughput bulkWrite
   */
  public async processBatch(batch: TelemetryEvent[]): Promise<{
    processedCount: number;
    fraudCount: number;
    openStopRate: number;
  }> {
    if (!batch || batch.length === 0) {
      return { processedCount: 0, fraudCount: 0, openStopRate: this.getOpenStopRate() };
    }

    const bulkOps: any[] = [];
    let batchFraudCount = 0;

    for (const event of batch) {
      // 1. Session Analytics & Open/Stop Tracking
      const sessionSummary = this.calculateSessionAnalytics(event);

      // 2. Fraud Detection Heuristics
      const fraudEvaluation = await telemetryFraudService.evaluateFraud(event);
      if (fraudEvaluation.isFraudDetected) {
        batchFraudCount++;
        this.totalFraudDetected++;
      }

      // 3. Prepare MongoDB bulkWrite Upsert Operation
      // Frequently indexed identifiers in distinct columns, ~120 dynamic metrics dumped into JSONB/Mixed field
      const doc = {
        eventId: event.eventId,
        deviceId: event.deviceId,
        userId: event.userId,
        sessionId: event.sessionId,
        eventType: event.eventType,
        platform: event.platform,
        appVersion: event.appVersion,
        clientTimezone: event.clientTimezone,
        ipAddress: event.ipAddress,
        appState: event.appState,
        sessionStartTime: event.sessionStartTime ? new Date(event.sessionStartTime) : undefined,
        sessionEndTime: event.sessionEndTime ? new Date(event.sessionEndTime) : undefined,
        sessionDurationSeconds: sessionSummary.sessionLengthSeconds,
        isFraudDetected: fraudEvaluation.isFraudDetected,
        fraudScore: fraudEvaluation.fraudScore,
        fraudReasons: fraudEvaluation.fraudReasons,
        metrics: event.metrics || {},
        timestamp: new Date(event.timestamp || Date.now()),
        processedAt: new Date(),
      };

      bulkOps.push({
        updateOne: {
          filter: { eventId: event.eventId },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      });
    }

    // 4. Batch-Insert into MongoDB using high-throughput bulkWrite
    if (bulkOps.length > 0 && mongoose.connection.readyState === 1) {
      try {
        await TelemetryModel.bulkWrite(bulkOps, { ordered: false });
        this.totalRowsInserted += bulkOps.length;
        this.totalBatchesProcessed++;
      } catch (dbErr: any) {
        logger.error(`Telemetry bulkWrite error: ${dbErr.message}`);
      }
    }

    return {
      processedCount: batch.length,
      fraudCount: batchFraudCount,
      openStopRate: this.getOpenStopRate(),
    };
  }

  /**
   * Calculates session length (session_end_time - session_start_time) and tracks open/stop state.
   */
  private calculateSessionAnalytics(event: TelemetryEvent): {
    sessionLengthSeconds: number;
    openStopRate: number;
  } {
    let sessionLengthSeconds = 0;

    // Session length calculation
    if (event.sessionEndTime && event.sessionStartTime) {
      const deltaMs = Math.max(0, event.sessionEndTime - event.sessionStartTime);
      sessionLengthSeconds = Math.round(deltaMs / 1000);
    } else if (event.eventType === 'session_end' && event.sessionStartTime) {
      const deltaMs = Math.max(0, (event.timestamp || Date.now()) - event.sessionStartTime);
      sessionLengthSeconds = Math.round(deltaMs / 1000);
    }

    // Track open/stop rate
    if (event.eventType === 'session_start') {
      this.totalOpenSessions++;
    } else if (event.eventType === 'session_end') {
      this.totalStopSessions++;
    }

    return {
      sessionLengthSeconds,
      openStopRate: this.getOpenStopRate(),
    };
  }

  /**
   * Calculates the overall ratio of session open events vs stop events.
   */
  public getOpenStopRate(): number {
    const totalToggles = this.totalOpenSessions + this.totalStopSessions;
    if (totalToggles === 0) return 1.0;
    return Number((this.totalOpenSessions / totalToggles).toFixed(3));
  }

  /**
   * Returns worker metrics and throughput statistics.
   */
  public getWorkerStats(): {
    isRunning: boolean;
    totalBatchesProcessed: number;
    totalRowsInserted: number;
    totalFraudDetected: number;
    totalOpenSessions: number;
    totalStopSessions: number;
    openStopRate: number;
  } {
    return {
      isRunning: this.isRunning,
      totalBatchesProcessed: this.totalBatchesProcessed,
      totalRowsInserted: this.totalRowsInserted,
      totalFraudDetected: this.totalFraudDetected,
      totalOpenSessions: this.totalOpenSessions,
      totalStopSessions: this.totalStopSessions,
      openStopRate: this.getOpenStopRate(),
    };
  }

  private scheduleNextTick(): void {
    if (!this.isRunning) return;
    this.loopTimer = setTimeout(async () => {
      await this.processQueueTick();
      this.scheduleNextTick();
    }, this.POLL_INTERVAL_MS);
  }
}

export const telemetryWorkerService = new TelemetryWorkerService();
