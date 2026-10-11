import axios from 'axios';
import { env } from '../core/config/env.config';
import { logger } from '../core/config/logger';

export class KeepAliveService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private intervalMinutes: number;
  private isEnabled: boolean;
  private targetUrl: string;

  constructor() {
    this.isEnabled = env.KEEPALIVE_ENABLED;
    this.intervalMinutes = env.KEEPALIVE_INTERVAL_MINUTES;
    // Target health endpoint - fallback to localhost if APP_URL is not fully qualified
    const baseUrl = env.APP_URL || `http://localhost:${env.PORT}`;
    this.targetUrl = `${baseUrl.replace(/\/$/, '')}${env.API_PREFIX}/health`;
  }

  /**
   * Starts the periodic anti-sleep / keep-alive heartbeat.
   */
  start(): void {
    if (!this.isEnabled) {
      logger.info('💤 Keep-Alive service is disabled via configuration (KEEPALIVE_ENABLED=false).');
      return;
    }

    if (this.isRunning) {
      logger.warn('Keep-Alive service is already running.');
      return;
    }

    this.isRunning = true;
    const intervalMs = this.intervalMinutes * 60 * 1000;

    logger.info(
      `💓 Keep-Alive Heartbeat initialized: Pinging ${this.targetUrl} every ${this.intervalMinutes} min(s).`
    );

    // Initial ping shortly after launch
    setTimeout(() => {
      if (this.isRunning) {
        this.ping();
      }
    }, 15000);

    // Recurring heartbeat interval
    this.timer = setInterval(() => {
      this.ping();
    }, intervalMs);
  }

  /**
   * Performs an individual HTTP heartbeat request.
   */
  async ping(): Promise<boolean> {
    try {
      const response = await axios.get(this.targetUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': `${env.APP_NAME}-KeepAliveHeartbeat/${env.APP_VERSION}`,
        },
      });

      if (response.status >= 200 && response.status < 300) {
        logger.info(
          `💓 Keep-Alive Heartbeat OK: ${this.targetUrl} responded with status ${response.status} at ${new Date().toISOString()}`
        );
        return true;
      } else {
        logger.warn(
          `⚠️ Keep-Alive Heartbeat warning: ${this.targetUrl} returned status ${response.status}`
        );
        return false;
      }
    } catch (err: any) {
      logger.warn(
        `⚠️ Keep-Alive Heartbeat ping failed (${err.code || err.message}). Server may still be bootstrapping or warming up.`
      );
      return false;
    }
  }

  /**
   * Stops the keep-alive timer during graceful shutdown.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('🛑 Keep-Alive Heartbeat service stopped.');
  }

  getStatus(): { isRunning: boolean; isEnabled: boolean; intervalMinutes: number; targetUrl: string } {
    return {
      isRunning: this.isRunning,
      isEnabled: this.isEnabled,
      intervalMinutes: this.intervalMinutes,
      targetUrl: this.targetUrl,
    };
  }
}

export const keepaliveService = new KeepAliveService();
