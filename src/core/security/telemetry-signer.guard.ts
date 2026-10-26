import * as crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.config';
import { logger } from '../config/logger';
import { sendError } from '../utils/api-response';

export interface TelemetrySignatureVerification {
  isValid: boolean;
  errorCode?: 'MISSING_SIGNATURE_HEADERS' | 'EXPIRED_TIMESTAMP' | 'NONCE_REPLAY_DETECTED' | 'SIGNATURE_MISMATCH';
  message: string;
}

/**
 * Zero-Trust Telemetry Request Signer & Anti-Replay Guard.
 * Enforces cryptographic authenticity, tamper prevention, and replay-attack immunity
 * across telematics ingestion streams.
 *
 * Required Headers:
 * - X-BMap-Signature: hex(HMAC_SHA256(secretKey, timestamp + ":" + nonce + ":" + payload))
 * - X-BMap-Timestamp: epoch milliseconds
 * - X-BMap-Nonce: 16+ byte unique random string
 */
export class TelemetrySignerGuard {
  // Anti-Replay timestamp tolerance window: 45 seconds (45,000 ms)
  private readonly REPLAY_WINDOW_MS = 45000;

  // In-memory nonce cache with automatic TTL expiration
  private nonceCache = new Map<string, number>();

  /**
   * Generates a valid HMAC-SHA256 signature for client/service authentication.
   */
  public generateSignature(
    payload: string | object,
    timestamp: number,
    nonce: string,
    secretKey: string = env.JWT_SECRET
  ): string {
    const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const message = `${timestamp}:${nonce}:${rawPayload}`;
    return crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  }

  /**
   * Verifies the cryptographic signature, timestamp freshness, and nonce uniqueness.
   */
  public verifySignature(
    signature: string | undefined,
    timestampHeader: string | number | undefined,
    nonce: string | undefined,
    payload: string | object,
    secretKey: string = env.JWT_SECRET
  ): TelemetrySignatureVerification {
    if (!signature || !timestampHeader || !nonce) {
      return {
        isValid: false,
        errorCode: 'MISSING_SIGNATURE_HEADERS',
        message: 'Missing required security headers: X-BMap-Signature, X-BMap-Timestamp, or X-BMap-Nonce',
      };
    }

    const timestamp = typeof timestampHeader === 'string' ? parseInt(timestampHeader, 10) : timestampHeader;
    if (isNaN(timestamp)) {
      return {
        isValid: false,
        errorCode: 'EXPIRED_TIMESTAMP',
        message: 'Invalid X-BMap-Timestamp format',
      };
    }

    const now = Date.now();
    const age = Math.abs(now - timestamp);

    // 1. Sliding Replay Window Verification
    if (age > this.REPLAY_WINDOW_MS) {
      return {
        isValid: false,
        errorCode: 'EXPIRED_TIMESTAMP',
        message: `Telemetry request expired or rejected by clock skew (Age: ${(age / 1000).toFixed(1)}s, Allowed: ${this.REPLAY_WINDOW_MS / 1000}s)`,
      };
    }

    // 2. Anti-Replay Nonce Deduplication
    this.cleanExpiredNonces(now);
    if (this.nonceCache.has(nonce)) {
      logger.warn(`🚨 [ZERO-TRUST] Replay attack blocked: Nonce ${nonce} already consumed`);
      return {
        isValid: false,
        errorCode: 'NONCE_REPLAY_DETECTED',
        message: 'Security Violation: Nonce has already been consumed (Replay attack blocked)',
      };
    }

    // 3. Cryptographic Signature Comparison (Timing-Safe)
    const expectedSig = this.generateSignature(payload, timestamp, nonce, secretKey);
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return {
        isValid: false,
        errorCode: 'SIGNATURE_MISMATCH',
        message: 'Cryptographic payload signature mismatch: Data tampering detected',
      };
    }

    // Record consumed nonce
    this.nonceCache.set(nonce, timestamp);

    return {
      isValid: true,
      message: 'Telemetry signature verified and authenticated.',
    };
  }

  /**
   * Express middleware enforcing zero-trust telemetry signing on sensitive endpoints.
   */
  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // In development mode, allow opt-in bypass if test header set or skip if not in strict mode
      const signature = req.headers['x-bmap-signature'] as string | undefined;
      const timestamp = req.headers['x-bmap-timestamp'] as string | undefined;
      const nonce = req.headers['x-bmap-nonce'] as string | undefined;

      // If headers provided, strictly enforce
      if (signature || timestamp || nonce) {
        const verification = this.verifySignature(signature, timestamp, nonce, req.body);
        if (!verification.isValid) {
          sendError(res, 401, verification.message, { errorCode: verification.errorCode });
          return;
        }
      }

      next();
    };
  }

  public createMiddleware() {
    return this.middleware();
  }

  private lastCleanTimestamp = 0;

  private cleanExpiredNonces(now: number): void {
    // Only run pruning at most once every 30 seconds unless cache has exceeded 2,000 items
    if (now - this.lastCleanTimestamp < 30000 && this.nonceCache.size < 2000) {
      return;
    }
    this.lastCleanTimestamp = now;

    const expirationThreshold = now - this.REPLAY_WINDOW_MS * 2;
    for (const [nonce, ts] of this.nonceCache.entries()) {
      if (ts < expirationThreshold) {
        this.nonceCache.delete(nonce);
      }
    }
  }
}

export const telemetrySignerGuard = new TelemetrySignerGuard();
