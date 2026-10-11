import mongoose from 'mongoose';
import { BeaconAnchorModel, IBeaconAnchor } from './beacon-anchor.model';
import { Coordinate } from '../../core/types/geo.types';
import { BleBeacon, WifiAccessPoint } from './positioning.types';
import { logger } from '../../core/config/logger';

export interface ResolvedWeakSignalFix {
  coordinates: Coordinate;
  accuracyMeters: number;
  source: 'ble_trilateration' | 'wifi_centroid' | 'hybrid';
  floorLevel?: number;
  matchedAnchorsCount: number;
}

export class WeakSignalResolverService {
  // In-memory anchor lookup cache to avoid DB roundtrips during high-frequency streams
  private anchorCache = new Map<string, IBeaconAnchor>();
  private cacheLoadedAt = 0;

  /**
   * Estimates distance (meters) using Log-Distance Path Loss Model:
   * d = 10 ^ ((TxPower - RSSI) / (10 * n))
   * @param rssi Observed RSSI in dBm
   * @param txPowerAt1m Measured power at 1 meter (default: -59 dBm)
   * @param pathLossExponent Environment factor (typically 2.2 - 3.2 for concrete garages)
   */
  estimateDistance(rssi: number, txPowerAt1m: number = -59, pathLossExponent: number = 2.6): number {
    if (rssi === 0) return 100.0;
    const ratio = (txPowerAt1m - rssi) / (10 * pathLossExponent);
    const dist = Math.pow(10, ratio);
    return Math.min(100.0, Math.max(0.1, dist));
  }

  /**
   * Refreshes anchor cache from MongoDB
   */
  async refreshAnchorCache(): Promise<void> {
    if (mongoose.connection.readyState !== 1) return;
    try {
      const anchors = await BeaconAnchorModel.find().lean().exec();
      this.anchorCache.clear();
      for (const a of anchors) {
        const key = `${a.uuid}:${a.major}:${a.minor}`;
        this.anchorCache.set(key, a as any);
      }
      this.cacheLoadedAt = Date.now();
      logger.debug(`Loaded ${this.anchorCache.size} beacon anchors into memory cache`);
    } catch (err: any) {
      logger.warn(`Failed loading beacon anchors: ${err.message}`);
    }
  }

  /**
   * Resolves position using Weighted Centroid Trilateration from BLE beacons
   */
  async resolveBlePosition(beacons: BleBeacon[]): Promise<ResolvedWeakSignalFix | null> {
    if (!beacons || beacons.length === 0) return null;

    if (Date.now() - this.cacheLoadedAt > 300000 && mongoose.connection.readyState === 1) {
      await this.refreshAnchorCache();
    }

    const matched: { anchor: IBeaconAnchor; distance: number; weight: number }[] = [];

    for (const b of beacons) {
      const key = `${b.uuid}:${b.major}:${b.minor}`;
      let anchor = this.anchorCache.get(key);

      if (!anchor && mongoose.connection.readyState === 1) {
        // Query database on cache miss if MongoDB is connected
        try {
          const found = await BeaconAnchorModel.findOne({
            uuid: b.uuid,
            major: b.major,
            minor: b.minor,
          }).lean().exec();
          if (found) {
            anchor = found as any;
            this.anchorCache.set(key, anchor!);
          }
        } catch {
          // Ignore
        }
      }

      if (anchor) {
        const txPower = b.txPower ?? anchor.txPowerAt1m ?? -59;
        const dist = this.estimateDistance(b.rssi, txPower);
        // Weight inversely proportional to distance squared
        const weight = 1 / Math.max(0.2, dist * dist);
        matched.push({ anchor, distance: dist, weight });
      }
    }

    if (matched.length === 0) return null;

    // Weighted centroid computation
    let totalWeight = 0;
    let sumLon = 0;
    let sumLat = 0;
    let sumFloor = 0;

    for (const item of matched) {
      totalWeight += item.weight;
      sumLon += item.anchor.location.coordinates[0] * item.weight;
      sumLat += item.anchor.location.coordinates[1] * item.weight;
      sumFloor += (item.anchor.floorLevel ?? 0) * item.weight;
    }

    const estLon = sumLon / totalWeight;
    const estLat = sumLat / totalWeight;
    const estFloor = Math.round(sumFloor / totalWeight);

    // Approximate accuracy radius from closest anchor distance and count
    const minDistance = Math.min(...matched.map((m) => m.distance));
    const accuracy = Math.max(1.5, minDistance * (matched.length >= 3 ? 1.0 : 1.8));

    return {
      coordinates: [estLon, estLat],
      accuracyMeters: Math.round(accuracy * 10) / 10,
      source: 'ble_trilateration',
      floorLevel: estFloor,
      matchedAnchorsCount: matched.length,
    };
  }

  /**
   * Registers a new beacon anchor for a facility (e.g. underground parking)
   */
  async registerAnchor(data: {
    uuid: string;
    major: number;
    minor: number;
    facilityName: string;
    facilityType: 'underground_parking' | 'tunnel' | 'indoor_mall' | 'terminal';
    floorLevel: number;
    coordinates: Coordinate;
    txPowerAt1m?: number;
    description?: string;
  }): Promise<any> {
    const key = `${data.uuid}:${data.major}:${data.minor}`;
    const anchorObj: any = {
      uuid: data.uuid,
      major: data.major,
      minor: data.minor,
      facilityName: data.facilityName,
      facilityType: data.facilityType,
      floorLevel: data.floorLevel,
      txPowerAt1m: data.txPowerAt1m ?? -59,
      location: { type: 'Point', coordinates: data.coordinates },
      description: data.description,
    };

    // Store in ultra-fast memory cache
    this.anchorCache.set(key, anchorObj);

    // Persist to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const persisted = await BeaconAnchorModel.findOneAndUpdate(
          { uuid: data.uuid, major: data.major, minor: data.minor },
          anchorObj,
          { upsert: true, returnDocument: 'after' }
        );
        return persisted;
      } catch (err: any) {
        logger.warn(`Failed persisting beacon anchor to MongoDB: ${err.message}`);
      }
    }

    return anchorObj;
  }
}

export const weakSignalResolverService = new WeakSignalResolverService();
