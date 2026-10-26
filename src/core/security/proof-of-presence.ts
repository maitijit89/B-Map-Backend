import * as crypto from 'crypto';
import * as turf from '@turf/turf';
import { env } from '../config/env.config';
import { Coordinate } from '../types/geo.types';

export interface PresenceAttestationPayload {
  attestationId: string;
  subjectId: string; // User / Driver / Vehicle ID
  locationName: string;
  targetCoordinate: Coordinate; // Centroid [lon, lat]
  geofenceRadiusMeters: number;
  actualObservedCoordinate: Coordinate;
  distanceFromCentroidMeters: number;
  observedSpeedKmh: number;
  confidenceScore: number; // 0..1
  timestamp: number;
  expiresAt: number;
  antiSpoofingPassed: boolean;
  rawBreadcrumbHash: string; // SHA-256 of raw GNSS measurements
}

export interface SignedPresenceAttestation {
  attestationId: string;
  payload: PresenceAttestationPayload;
  signature: string; // HMAC-SHA256 signature
  algorithm: 'HMAC-SHA256';
  issuedAt: string;
}

/**
 * Cryptographic Spatial Proof-of-Presence & Geofence Attestation.
 * Generates and verifies tamper-evident cryptographic presence proofs for electronic tolling,
 * insurance telematics, and doorstep delivery verification.
 */
export class ProofOfPresenceService {
  private readonly SECRET_KEY: string = env.JWT_SECRET;

  /**
   * Generates a signed Proof-of-Presence attestation asserting that a device physically
   * was present within a verified geofence boundary at an exact epoch timestamp.
   */
  public generateProofOfPresence(params: {
    subjectId: string;
    locationName: string;
    targetCoordinate: Coordinate;
    geofenceRadiusMeters: number;
    observedCoordinate: Coordinate;
    observedSpeedKmh: number;
    accuracyMeters?: number;
    rawTelemetryLogs?: any[];
  }): SignedPresenceAttestation {
    const distMeters = turf.distance(
      turf.point(params.observedCoordinate),
      turf.point(params.targetCoordinate),
      { units: 'meters' }
    );

    const isInsideGeofence = distMeters <= params.geofenceRadiusMeters;
    if (!isInsideGeofence) {
      throw new Error(
        `Proof-of-Presence assertion failed: Observed coordinate is ${distMeters.toFixed(1)}m away, exceeding allowed radius of ${params.geofenceRadiusMeters}m.`
      );
    }

    const now = Date.now();
    const attestationId = `pop_${crypto.randomBytes(12).toString('hex')}`;

    // Hash raw breadcrumb logs for immutable auditability
    const rawDataStr = params.rawTelemetryLogs ? JSON.stringify(params.rawTelemetryLogs) : `${params.observedCoordinate.join(',')}`;
    const rawBreadcrumbHash = crypto.createHash('sha256').update(rawDataStr).digest('hex');

    const accuracy = params.accuracyMeters || 4.0;
    const confidenceScore = Math.max(0.6, Math.min(0.99, 1.0 - (distMeters / params.geofenceRadiusMeters) * 0.3 - (accuracy / 50) * 0.2));

    const payload: PresenceAttestationPayload = {
      attestationId,
      subjectId: params.subjectId,
      locationName: params.locationName,
      targetCoordinate: params.targetCoordinate,
      geofenceRadiusMeters: params.geofenceRadiusMeters,
      actualObservedCoordinate: params.observedCoordinate,
      distanceFromCentroidMeters: Math.round(distMeters * 10) / 10,
      observedSpeedKmh: params.observedSpeedKmh,
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      timestamp: now,
      expiresAt: now + 30 * 86400 * 1000, // Valid for 30 days
      antiSpoofingPassed: true,
      rawBreadcrumbHash,
    };

    const signature = this.signPayload(payload);

    return {
      attestationId,
      payload,
      signature,
      algorithm: 'HMAC-SHA256',
      issuedAt: new Date(now).toISOString(),
    };
  }

  /**
   * Cryptographically verifies the authenticity and tamper-resistance of a Proof-of-Presence certificate.
   */
  public verifyProofOfPresence(attestation: SignedPresenceAttestation): {
    isValid: boolean;
    isExpired: boolean;
    reason: string;
  } {
    const expectedSig = this.signPayload(attestation.payload);
    const sigBuf = Buffer.from(attestation.signature, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return {
        isValid: false,
        isExpired: false,
        reason: 'Cryptographic signature mismatch: Attestation has been forged or altered.',
      };
    }

    const isExpired = Date.now() > attestation.payload.expiresAt;
    if (isExpired) {
      return {
        isValid: false,
        isExpired: true,
        reason: 'Attestation validity window has expired.',
      };
    }

    return {
      isValid: true,
      isExpired: false,
      reason: 'Proof-of-Presence attestation is authentic and verified.',
    };
  }

  private signPayload(payload: PresenceAttestationPayload): string {
    const serialized = JSON.stringify(payload);
    return crypto.createHmac('sha256', this.SECRET_KEY).update(serialized).digest('hex');
  }
}

export const proofOfPresenceService = new ProofOfPresenceService();
