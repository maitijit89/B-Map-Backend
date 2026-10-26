import crypto from 'crypto';
import { env } from '../config/env.config';
import { logger } from '../config/logger';
import { Coordinate } from '../types/geo.types';
import {
  antiSpoofingGuard,
  HistoricalTelemetryPoint,
  TelemetryPlausibilityAssessment,
} from './anti-spoofing.guard';
import {
  proofOfPresenceService,
  SignedPresenceAttestation,
} from './proof-of-presence';

export interface TelemetrySignaturePayload {
  deviceId: string;
  coordinate: Coordinate;
  speedKmh: number;
  timestamp: number;
  nonce: string;
}

export interface ZeroTrustVerificationResult {
  isValid: boolean;
  kinematicAssessment: TelemetryPlausibilityAssessment;
  signatureValid: boolean;
  replayValid: boolean;
  rejectionReason?: string;
  verifiedAt: number;
}

/**
 * Zero-Trust Kinematic Anti-GPS Spoofing, Replay Immunity & Cryptographic Security Engine
 * Fuses continuous physical kinematics verification, HMAC-SHA256 packet authentication,
 * sliding-window replay defense, and spatial proof-of-presence attestation per algorithm.md Section 12.
 */
export class ZeroTrustSecurityEngineService {
  private readonly SECRET_KEY = env.JWT_SECRET;
  // Maximum permissible clock drift window for telemetry packets: 60 seconds
  private readonly MAX_TIMESTAMP_DRIFT_MS = 60000;
  // Nonce cache to prevent replay injection
  private observedNonces = new Set<string>();

  /**
   * Signs a client telemetry packet with HMAC-SHA256.
   */
  public signTelemetryPacket(payload: TelemetrySignaturePayload): string {
    const raw = `${payload.deviceId}:${payload.coordinate[0]}:${payload.coordinate[1]}:${payload.speedKmh}:${payload.timestamp}:${payload.nonce}`;
    return crypto.createHmac('sha256', this.SECRET_KEY).update(raw).digest('hex');
  }

  /**
   * Verifies an incoming telemetry packet against:
   * 1. HMAC-SHA256 Cryptographic Signature
   * 2. Replay Protection (timestamp freshness + nonce deduplication)
   * 3. Kinematic Plausibility (acceleration, top speed, micro-entropy)
   */
  public verifyTelemetryPacket(params: {
    deviceId: string;
    coordinate: Coordinate;
    speedKmh: number;
    headingDeg?: number;
    timestamp: number;
    nonce?: string;
    signature?: string;
  }): ZeroTrustVerificationResult {
    const now = Date.now();
    let signatureValid = true;
    let replayValid = true;
    let rejectionReason: string | undefined;

    // 1. Replay Attack & Timestamp Drift Validation
    const timeDrift = Math.abs(now - params.timestamp);
    if (timeDrift > this.MAX_TIMESTAMP_DRIFT_MS) {
      replayValid = false;
      rejectionReason = `Replay attack detected: Timestamp drift of ${(timeDrift / 1000).toFixed(1)}s exceeds allowed 60s window.`;
      logger.warn(`🚨 [ZERO-TRUST ENGINE] ${rejectionReason} (Device: ${params.deviceId})`);
    }

    if (params.nonce) {
      const nonceKey = `${params.deviceId}:${params.nonce}`;
      if (this.observedNonces.has(nonceKey)) {
        replayValid = false;
        rejectionReason = `Replay attack detected: Duplicate nonce '${params.nonce}' reused for device ${params.deviceId}.`;
        logger.warn(`🚨 [ZERO-TRUST ENGINE] ${rejectionReason}`);
      } else {
        if (this.observedNonces.size > 10000) {
          const oldest = this.observedNonces.keys().next().value;
          if (oldest) this.observedNonces.delete(oldest);
        }
        this.observedNonces.add(nonceKey);
      }
    }

    // 2. Cryptographic Signature Verification (if provided)
    if (params.signature && params.nonce) {
      const expectedSignature = this.signTelemetryPacket({
        deviceId: params.deviceId,
        coordinate: params.coordinate,
        speedKmh: params.speedKmh,
        timestamp: params.timestamp,
        nonce: params.nonce,
      });

      const sigBuffer = Buffer.from(params.signature, 'hex');
      const expBuffer = Buffer.from(expectedSignature, 'hex');

      if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
        signatureValid = false;
        rejectionReason = 'HMAC-SHA256 signature verification failed: telemetry packet altered in transit.';
        logger.warn(`🚨 [ZERO-TRUST ENGINE] ${rejectionReason} (Device: ${params.deviceId})`);
      }
    }

    // 3. Physical Kinematics Assessment
    const telemetryPoint: HistoricalTelemetryPoint = {
      coordinate: params.coordinate,
      speedKmh: params.speedKmh,
      headingDeg: params.headingDeg ?? 0,
      timestamp: params.timestamp,
    };
    const kinematicAssessment = antiSpoofingGuard.verifyTelemetryPlausibility(
      params.deviceId,
      telemetryPoint
    );

    if (!kinematicAssessment.isPlausible && !rejectionReason) {
      rejectionReason = kinematicAssessment.explanation;
    }

    const isValid = signatureValid && replayValid && kinematicAssessment.isPlausible;

    return {
      isValid,
      kinematicAssessment,
      signatureValid,
      replayValid,
      rejectionReason,
      verifiedAt: now,
    };
  }

  /**
   * Generates a signed Proof-of-Presence attestation.
   */
  public generateProofOfPresence(params: {
    subjectId: string;
    locationName: string;
    targetCoordinate: Coordinate;
    geofenceRadiusMeters: number;
    observedCoordinate: Coordinate;
    observedSpeedKmh: number;
  }): SignedPresenceAttestation {
    return proofOfPresenceService.generateProofOfPresence(params);
  }

  /**
   * Verifies a signed Proof-of-Presence attestation.
   */
  public verifyProofOfPresence(attestation: SignedPresenceAttestation): {
    isValid: boolean;
    isExpired: boolean;
    reason: string;
  } {
    return proofOfPresenceService.verifyProofOfPresence(attestation);
  }
}

export const zeroTrustSecurityEngineService = new ZeroTrustSecurityEngineService();
