import mongoose from 'mongoose';
import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';
import { Coordinate } from '../../core/types/geo.types';
import { escapeRegExp } from '../../core/utils/security.utils';
import { IndoorBeaconModel } from './indoor-beacon.model';
import {
  BluetoothClientPermissions,
  IndoorBeaconRecord,
  IndoorBeaconTranslationRequest,
  IndoorBeaconTranslationResult,
  IndoorFacilityType,
  MatchedBeaconDetail,
  PermissionValidationResult,
  ScannedBeaconPayload,
} from './nearby-devices.types';

export class IndoorBeaconMappingService {
  // In-memory high-speed cache for sub-millisecond beacon lookups
  private beaconCache = new Map<string, IndoorBeaconRecord>();
  // Index for iBeacon: "uuid:major:minor" -> beaconId
  private iBeaconIndex = new Map<string, string>();
  private cacheLoadedAt = 0;

  constructor() {
    this.seedDefaultIndoorBeacons();
  }

  /**
   * Seeds demo indoor beacons across Indian weak-signal spaces:
   * 1. Underground Parking Garages (Cyber Hub Gurugram B2/B1)
   * 2. Multi-Level Shopping Centers (DLF Mall of India, Noida)
   * 3. International Airport Terminals (Delhi IGI T3 Arrivals / Baggage Reclaim)
   */
  private seedDefaultIndoorBeacons(): void {
    const defaultBeacons: IndoorBeaconRecord[] = [
      // =========================================================================
      // 1. UNDERGROUND PARKING GARAGE: DLF Cyber Hub Basement B2 (Gurugram)
      // Weak GPS / Cellular signal zone (Pillar grid parking)
      // =========================================================================
      {
        beaconId: 'bcn_cybercity_b2_p12',
        facilityId: 'fac_cybercity_gurugram',
        facilityName: 'DLF Cyber City & Cyber Hub Multi-Tower Complex',
        facilityType: 'underground_parking',
        floorLevel: -2,
        floorName: 'Basement Level 2 (Blue Zone - Underground Garage)',
        zone: 'Pillar P-12, Blue Zone',
        indoorX: 25.0,
        indoorY: 40.0,
        indoorZ: 2.8,
        geographicLocation: [77.0872, 28.4947],
        altitudeMeters: 204.0,
        txPowerAt1m: -59,
        pathLossExponent: 2.8,
        coverageRadiusMeters: 25,
        protocol: 'ibeacon',
        uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
        major: 200,
        minor: 12,
        macAddress: 'C4:4E:AC:10:00:12',
        status: 'active',
      },
      {
        beaconId: 'bcn_cybercity_b2_p14',
        facilityId: 'fac_cybercity_gurugram',
        facilityName: 'DLF Cyber City & Cyber Hub Multi-Tower Complex',
        facilityType: 'underground_parking',
        floorLevel: -2,
        floorName: 'Basement Level 2 (Blue Zone - Underground Garage)',
        zone: 'Pillar P-14, Blue Zone (Near Lift Lobby B)',
        indoorX: 35.0,
        indoorY: 40.0,
        indoorZ: 2.8,
        geographicLocation: [77.0874, 28.4947],
        altitudeMeters: 204.0,
        txPowerAt1m: -59,
        pathLossExponent: 2.8,
        coverageRadiusMeters: 25,
        protocol: 'ibeacon',
        uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
        major: 200,
        minor: 14,
        macAddress: 'C4:4E:AC:10:00:14',
        status: 'active',
      },
      {
        beaconId: 'bcn_cybercity_b2_p22',
        facilityId: 'fac_cybercity_gurugram',
        facilityName: 'DLF Cyber City & Cyber Hub Multi-Tower Complex',
        facilityType: 'underground_parking',
        floorLevel: -2,
        floorName: 'Basement Level 2 (Green Zone - EV Charging)',
        zone: 'Pillar P-22, Green Zone (EV Charging Bay)',
        indoorX: 25.0,
        indoorY: 60.0,
        indoorZ: 2.8,
        geographicLocation: [77.0872, 28.4951],
        altitudeMeters: 204.0,
        txPowerAt1m: -59,
        pathLossExponent: 2.8,
        coverageRadiusMeters: 25,
        protocol: 'ibeacon',
        uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
        major: 200,
        minor: 22,
        macAddress: 'C4:4E:AC:10:00:22',
        status: 'active',
      },
      {
        beaconId: 'bcn_cybercity_b2_p24',
        facilityId: 'fac_cybercity_gurugram',
        facilityName: 'DLF Cyber City & Cyber Hub Multi-Tower Complex',
        facilityType: 'underground_parking',
        floorLevel: -2,
        floorName: 'Basement Level 2 (Green Zone - Underground Garage)',
        zone: 'Pillar P-24, Green Zone',
        indoorX: 35.0,
        indoorY: 60.0,
        indoorZ: 2.8,
        geographicLocation: [77.0874, 28.4951],
        altitudeMeters: 204.0,
        txPowerAt1m: -59,
        pathLossExponent: 2.8,
        coverageRadiusMeters: 25,
        protocol: 'ibeacon',
        uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
        major: 200,
        minor: 24,
        macAddress: 'C4:4E:AC:10:00:24',
        status: 'active',
      },

      // Basement B1 Garage Beacons
      {
        beaconId: 'bcn_cybercity_b1_p08',
        facilityId: 'fac_cybercity_gurugram',
        facilityName: 'DLF Cyber City & Cyber Hub Multi-Tower Complex',
        facilityType: 'underground_parking',
        floorLevel: -1,
        floorName: 'Basement Level 1 (Valet Dropoff & Pre-Booked Parking)',
        zone: 'Pillar P-08, Valet Desk B1',
        indoorX: 20.0,
        indoorY: 30.0,
        indoorZ: 2.8,
        geographicLocation: [77.0871, 28.4945],
        altitudeMeters: 207.0,
        txPowerAt1m: -59,
        pathLossExponent: 2.8,
        coverageRadiusMeters: 25,
        protocol: 'ibeacon',
        uuid: 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0',
        major: 100,
        minor: 8,
        macAddress: 'C4:4E:AC:10:01:08',
        status: 'active',
      },

      // =========================================================================
      // 2. MULTI-LEVEL SHOPPING CENTER: DLF Mall of India (Noida)
      // Weak GPS / Complex multi-floor retail atrium
      // =========================================================================
      {
        beaconId: 'bcn_moi_l1_central_atrium',
        facilityId: 'fac_mall_of_india_noida',
        facilityName: 'DLF Mall of India',
        facilityType: 'shopping_center',
        floorLevel: 1,
        floorName: 'Level 1 - International Fashion Galleria',
        zone: 'Central Atrium Fountain',
        indoorX: 50.0,
        indoorY: 50.0,
        indoorZ: 3.5,
        geographicLocation: [77.3211, 28.5678],
        altitudeMeters: 215.0,
        txPowerAt1m: -59,
        pathLossExponent: 2.2,
        coverageRadiusMeters: 30,
        protocol: 'ibeacon',
        uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825',
        major: 10,
        minor: 1,
        macAddress: 'D8:96:E0:20:00:01',
        status: 'active',
      },
      {
        beaconId: 'bcn_moi_l1_zara_corridor',
        facilityId: 'fac_mall_of_india_noida',
        facilityName: 'DLF Mall of India',
        facilityType: 'shopping_center',
        floorLevel: 1,
        floorName: 'Level 1 - International Fashion Galleria',
        zone: 'North Wing - Zara Frontage Corridor',
        indoorX: 70.0,
        indoorY: 50.0,
        indoorZ: 3.2,
        geographicLocation: [77.3215, 28.5678],
        altitudeMeters: 215.0,
        txPowerAt1m: -59,
        pathLossExponent: 2.2,
        coverageRadiusMeters: 30,
        protocol: 'ibeacon',
        uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825',
        major: 10,
        minor: 2,
        macAddress: 'D8:96:E0:20:00:02',
        status: 'active',
      },
      {
        beaconId: 'bcn_moi_l1_escalator_bank',
        facilityId: 'fac_mall_of_india_noida',
        facilityName: 'DLF Mall of India',
        facilityType: 'shopping_center',
        floorLevel: 1,
        floorName: 'Level 1 - International Fashion Galleria',
        zone: 'Central Escalator Bank (Ascent to L2 Food Court)',
        indoorX: 50.0,
        indoorY: 70.0,
        indoorZ: 3.5,
        geographicLocation: [77.3211, 28.5682],
        altitudeMeters: 215.0,
        txPowerAt1m: -59,
        pathLossExponent: 2.2,
        coverageRadiusMeters: 30,
        protocol: 'ibeacon',
        uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825',
        major: 10,
        minor: 3,
        macAddress: 'D8:96:E0:20:00:03',
        status: 'active',
      },

      // =========================================================================
      // 3. INTERNATIONAL AIRPORT: Delhi IGI Airport Terminal 3
      // Underground Baggage Reclaim Hall (Zero GPS Signal)
      // =========================================================================
      {
        beaconId: 'bcn_igi_t3_belt_05',
        facilityId: 'fac_igi_t3_delhi',
        facilityName: 'Indira Gandhi International Airport Terminal 3',
        facilityType: 'airport_terminal',
        floorLevel: 0,
        floorName: 'Ground Level - International Arrivals & Baggage Reclaim',
        zone: 'Baggage Belt 5 (International Widebody Arrivals)',
        indoorX: 80.0,
        indoorY: 120.0,
        indoorZ: 4.0,
        geographicLocation: [77.0845, 28.5562],
        altitudeMeters: 232.0,
        txPowerAt1m: -59,
        pathLossExponent: 2.4,
        coverageRadiusMeters: 35,
        protocol: 'ibeacon',
        uuid: '74278BDA-B644-4520-8F0C-720EAF059935',
        major: 3,
        minor: 5,
        macAddress: 'F0:18:98:30:00:05',
        status: 'active',
      },
      {
        beaconId: 'bcn_igi_t3_belt_06',
        facilityId: 'fac_igi_t3_delhi',
        facilityName: 'Indira Gandhi International Airport Terminal 3',
        facilityType: 'airport_terminal',
        floorLevel: 0,
        floorName: 'Ground Level - International Arrivals & Baggage Reclaim',
        zone: 'Baggage Belt 6',
        indoorX: 95.0,
        indoorY: 120.0,
        indoorZ: 4.0,
        geographicLocation: [77.0848, 28.5562],
        altitudeMeters: 232.0,
        txPowerAt1m: -59,
        pathLossExponent: 2.4,
        coverageRadiusMeters: 35,
        protocol: 'ibeacon',
        uuid: '74278BDA-B644-4520-8F0C-720EAF059935',
        major: 3,
        minor: 6,
        macAddress: 'F0:18:98:30:00:06',
        status: 'active',
      },
      {
        beaconId: 'bcn_igi_t3_customs_exit',
        facilityId: 'fac_igi_t3_delhi',
        facilityName: 'Indira Gandhi International Airport Terminal 3',
        facilityType: 'airport_terminal',
        floorLevel: 0,
        floorName: 'Ground Level - International Arrivals',
        zone: 'Customs Green Channel Exit to Public Concierge',
        indoorX: 110.0,
        indoorY: 120.0,
        indoorZ: 4.0,
        geographicLocation: [77.0851, 28.5562],
        altitudeMeters: 232.0,
        txPowerAt1m: -59,
        pathLossExponent: 2.4,
        coverageRadiusMeters: 35,
        protocol: 'ibeacon',
        uuid: '74278BDA-B644-4520-8F0C-720EAF059935',
        major: 3,
        minor: 7,
        macAddress: 'F0:18:98:30:00:07',
        status: 'active',
      },
    ];

    for (const b of defaultBeacons) {
      this.beaconCache.set(b.beaconId, b);
      if (b.uuid && b.major !== undefined && b.minor !== undefined) {
        const iBeaconKey = `${b.uuid.toUpperCase()}:${b.major}:${b.minor}`;
        this.iBeaconIndex.set(iBeaconKey, b.beaconId);
      }
    }

    this.cacheLoadedAt = Date.now();
    logger.info(
      `📡 Initialized Indoor Beacon Database with ${this.beaconCache.size} calibrated beacons across underground garages, shopping malls, and airports.`
    );
  }

  /**
   * Syncs memory cache with MongoDB when database is connected.
   */
  async syncDatabaseBeacons(): Promise<void> {
    if (mongoose.connection.readyState !== 1) return;

    try {
      // 1. Ensure default seed beacons exist in MongoDB
      const count = await IndoorBeaconModel.countDocuments();
      if (count === 0) {
        const seedDocs = Array.from(this.beaconCache.values()).map((b) => ({
          ...b,
          geographicLocation: {
            type: 'Point',
            coordinates: b.geographicLocation,
          },
        }));
        await IndoorBeaconModel.insertMany(seedDocs);
        logger.info(`💾 Seeded ${seedDocs.length} indoor beacons into MongoDB IndoorBeacon collection.`);
      }

      // 2. Load latest database beacons into cache
      const dbBeacons = await IndoorBeaconModel.find({ status: 'active' }).lean().exec();
      for (const raw of dbBeacons) {
        const b: IndoorBeaconRecord = {
          beaconId: raw.beaconId,
          facilityId: raw.facilityId,
          facilityName: raw.facilityName,
          facilityType: raw.facilityType as IndoorFacilityType,
          floorLevel: raw.floorLevel,
          floorName: raw.floorName,
          zone: raw.zone,
          indoorX: raw.indoorX,
          indoorY: raw.indoorY,
          indoorZ: raw.indoorZ,
          geographicLocation: raw.geographicLocation.coordinates as Coordinate,
          altitudeMeters: raw.altitudeMeters,
          txPowerAt1m: raw.txPowerAt1m,
          pathLossExponent: raw.pathLossExponent,
          coverageRadiusMeters: raw.coverageRadiusMeters,
          protocol: raw.protocol,
          uuid: raw.uuid,
          major: raw.major,
          minor: raw.minor,
          namespaceId: raw.namespaceId,
          instanceId: raw.instanceId,
          macAddress: raw.macAddress,
          status: raw.status as any,
        };

        this.beaconCache.set(b.beaconId, b);
        if (b.uuid && b.major !== undefined && b.minor !== undefined) {
          const iBeaconKey = `${b.uuid.toUpperCase()}:${b.major}:${b.minor}`;
          this.iBeaconIndex.set(iBeaconKey, b.beaconId);
        }
      }
      this.cacheLoadedAt = Date.now();
    } catch (err: any) {
      logger.warn(`MongoDB indoor beacon sync warning: ${err.message}`);
    }
  }

  /**
   * Validates client Bluetooth scan permissions:
   * - Android 12+ (API 31+): BLUETOOTH_SCAN, BLUETOOTH_CONNECT
   * - Android < 12 legacy: ACCESS_FINE_LOCATION
   * - iOS: Bluetooth Sharing (NSBluetoothAlwaysUsageDescription)
   */
  verifyBluetoothPermissions(
    permissions?: BluetoothClientPermissions
  ): PermissionValidationResult {
    if (!permissions) {
      // Allow backwards-compatible execution with warning if permissions object was omitted
      return {
        isValid: true,
        platform: 'android',
        message: 'Client permissions omitted in payload; proceeding with best-effort scan translation.',
      };
    }

    const { platform } = permissions;

    if (platform === 'android') {
      const hasBleScan = permissions.bluetoothScan === true;
      const hasBleConnect = permissions.bluetoothConnect === true;
      const hasLegacyFineLoc = permissions.accessFineLocation === true;

      // Android 12+ requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT.
      // Legacy Android requires ACCESS_FINE_LOCATION to discover BLE beacons.
      if (!hasBleScan && !hasLegacyFineLoc) {
        return {
          isValid: false,
          platform: 'android',
          missingPermissions: ['BLUETOOTH_SCAN', 'ACCESS_FINE_LOCATION'],
          errorCode: 'BLUETOOTH_PERMISSION_DENIED',
          message:
            'Client permission rejected: Android requires BLUETOOTH_SCAN (Android 12+) or ACCESS_FINE_LOCATION to scan nearby BLE beacons.',
        };
      }

      if (hasBleScan && !hasBleConnect) {
        logger.debug('Android device has BLUETOOTH_SCAN but BLUETOOTH_CONNECT is not explicitly flagged.');
      }

      return {
        isValid: true,
        platform: 'android',
        message: 'Android Bluetooth permissions verified (BLUETOOTH_SCAN / BLUETOOTH_CONNECT active).',
      };
    }

    if (platform === 'ios') {
      const hasBluetoothSharing =
        permissions.bluetoothSharing === true ||
        permissions.authorizationStatus === 'authorized';

      if (!hasBluetoothSharing) {
        return {
          isValid: false,
          platform: 'ios',
          missingPermissions: ['Bluetooth Sharing (NSBluetoothAlwaysUsageDescription)'],
          errorCode: 'BLUETOOTH_PERMISSION_DENIED',
          message:
            'Client permission rejected: iOS requires Bluetooth Sharing (Remote Bluetooth / CoreBluetooth authorization) to detect nearby BLE beacons.',
        };
      }

      return {
        isValid: true,
        platform: 'ios',
        message: 'iOS Bluetooth Sharing authorization verified (CoreBluetooth active).',
      };
    }

    return {
      isValid: true,
      platform,
      message: `Client platform "${platform}" permissions verified.`,
    };
  }

  /**
   * Estimates distance (meters) using the Log-Distance Path Loss Model:
   *   d = 10 ^ ((TxPower - RSSI) / (10 * n))
   *
   * @param rssi Observed RSSI in dBm (e.g., -68 dBm)
   * @param txPower Calibrated reference RSSI at 1 meter (e.g., -59 dBm)
   * @param pathLossExponent Environmental path loss exponent (2.0–3.5)
   */
  estimateDistanceMeters(
    rssi: number,
    txPower: number = -59,
    pathLossExponent: number = 2.6
  ): number {
    if (rssi === 0 || isNaN(rssi)) return 30.0;
    // Cap path loss calculation between realistic physical limits (0.2m to 50m)
    const ratio = (txPower - rssi) / (10 * pathLossExponent);
    const distance = Math.pow(10, ratio);
    return Math.min(50.0, Math.max(0.2, Number(distance.toFixed(2))));
  }

  /**
   * Resolves a single scanned beacon payload to an IndoorBeaconRecord
   */
  async resolveBeaconRecord(scanned: ScannedBeaconPayload): Promise<IndoorBeaconRecord | null> {
    // 1. Direct lookup by beaconId
    if (scanned.beaconId && this.beaconCache.has(scanned.beaconId)) {
      return this.beaconCache.get(scanned.beaconId)!;
    }

    // 2. Lookup by iBeacon tuple (uuid, major, minor)
    if (scanned.uuid && scanned.major !== undefined && scanned.minor !== undefined) {
      const key = `${scanned.uuid.toUpperCase()}:${scanned.major}:${scanned.minor}`;
      const mappedId = this.iBeaconIndex.get(key);
      if (mappedId && this.beaconCache.has(mappedId)) {
        return this.beaconCache.get(mappedId)!;
      }
    }

    // 3. Lookup by hardware MAC address
    if (scanned.macAddress) {
      for (const b of this.beaconCache.values()) {
        if (b.macAddress && b.macAddress.toUpperCase() === scanned.macAddress.toUpperCase()) {
          return b;
        }
      }
    }

    // 4. Redis Fast Lookup Fallback
    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        const searchKey = scanned.beaconId
          ? `beacon:id:${scanned.beaconId}`
          : scanned.uuid && scanned.major !== undefined && scanned.minor !== undefined
          ? `beacon:ibeacon:${scanned.uuid.toUpperCase()}:${scanned.major}:${scanned.minor}`
          : null;

        if (searchKey) {
          const raw = await redis.get(searchKey);
          if (raw) {
            const parsed: IndoorBeaconRecord = JSON.parse(raw);
            this.beaconCache.set(parsed.beaconId, parsed);
            return parsed;
          }
        }
      }
    } catch {
      // Redis skip
    }

    // 5. MongoDB Fallback
    if (mongoose.connection.readyState === 1) {
      try {
        const query: any = {};
        if (scanned.beaconId) query.beaconId = scanned.beaconId;
        else if (scanned.uuid && scanned.major !== undefined && scanned.minor !== undefined) {
          query.uuid = new RegExp(`^${escapeRegExp(scanned.uuid)}$`, 'i');
          query.major = scanned.major;
          query.minor = scanned.minor;
        } else if (scanned.macAddress) {
          query.macAddress = new RegExp(`^${escapeRegExp(scanned.macAddress)}$`, 'i');
        }

        if (Object.keys(query).length > 0) {
          const found = await IndoorBeaconModel.findOne(query).lean().exec();
          if (found) {
            const b: IndoorBeaconRecord = {
              beaconId: found.beaconId,
              facilityId: found.facilityId,
              facilityName: found.facilityName,
              facilityType: found.facilityType as any,
              floorLevel: found.floorLevel,
              floorName: found.floorName,
              zone: found.zone,
              indoorX: found.indoorX,
              indoorY: found.indoorY,
              indoorZ: found.indoorZ,
              geographicLocation: found.geographicLocation.coordinates as Coordinate,
              altitudeMeters: found.altitudeMeters,
              txPowerAt1m: found.txPowerAt1m,
              pathLossExponent: found.pathLossExponent,
              coverageRadiusMeters: found.coverageRadiusMeters,
              protocol: found.protocol,
              uuid: found.uuid,
              major: found.major,
              minor: found.minor,
              namespaceId: found.namespaceId,
              instanceId: found.instanceId,
              macAddress: found.macAddress,
              status: found.status as any,
            };
            this.beaconCache.set(b.beaconId, b);
            return b;
          }
        }
      } catch (err: any) {
        logger.debug(`MongoDB lookup skipped: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Translates client scanned BLE beacon IDs and RSSI measurements into exact indoor X/Y coordinates.
   * Performs:
   * 1. Client Bluetooth permission verification.
   * 2. Beacon matching against indoor mapping database.
   * 3. Floor isolation (prevents vertical BLE signal bleeding across levels).
   * 4. Multi-beacon weighted trilateration / centroid calculation for high accuracy (< 2.5m).
   * 5. Georeferenced WGS-84 coordinate synthesis for weak-signal GPS replacement.
   */
  async translateBeaconsToIndoorCoordinates(
    request: IndoorBeaconTranslationRequest
  ): Promise<IndoorBeaconTranslationResult> {
    const { beacons, permissions } = request;

    // 1. Verify Client Bluetooth Permissions
    const permResult = this.verifyBluetoothPermissions(permissions);
    if (!permResult.isValid) {
      throw new Error(permResult.message);
    }

    if (!beacons || beacons.length === 0) {
      throw new Error('No scanned beacons provided in payload to translate.');
    }

    // Refresh database beacons if needed
    if (Date.now() - this.cacheLoadedAt > 300000 && mongoose.connection.readyState === 1) {
      await this.syncDatabaseBeacons();
    }

    // 2. Query Indoor Mapping Database for each scanned beacon
    const matchedList: {
      beacon: IndoorBeaconRecord;
      rssi: number;
      distanceMeters: number;
    }[] = [];

    for (const scanned of beacons) {
      const beaconRecord = await this.resolveBeaconRecord(scanned);
      if (beaconRecord && beaconRecord.status === 'active') {
        const txPower = scanned.txPower ?? beaconRecord.txPowerAt1m ?? -59;
        const n = beaconRecord.pathLossExponent ?? 2.6;
        const distanceMeters = this.estimateDistanceMeters(scanned.rssi, txPower, n);

        matchedList.push({
          beacon: beaconRecord,
          rssi: scanned.rssi,
          distanceMeters,
        });
      }
    }

    if (matchedList.length === 0) {
      throw new Error(
        'None of the scanned beacon IDs matched known beacons in the indoor mapping database.'
      );
    }

    // 3. Floor Level Disambiguation (Isolate Dominant Floor Level)
    // BLE signals can bleed between concrete slabs (e.g. B2 vs B1). We group by floor and sum inverse distance weights.
    const floorEnergyMap = new Map<number, { count: number; totalWeight: number; facilityId: string }>();

    for (const item of matchedList) {
      const fl = item.beacon.floorLevel;
      const weight = 1 / Math.max(0.1, item.distanceMeters);
      const existing = floorEnergyMap.get(fl) || { count: 0, totalWeight: 0, facilityId: item.beacon.facilityId };
      existing.count += 1;
      existing.totalWeight += weight;
      floorEnergyMap.set(fl, existing);
    }

    // Identify dominant floor level with highest aggregate signal energy
    let dominantFloorLevel = matchedList[0].beacon.floorLevel;
    let maxWeight = -1;
    for (const [fl, data] of floorEnergyMap.entries()) {
      if (data.totalWeight > maxWeight) {
        maxWeight = data.totalWeight;
        dominantFloorLevel = fl;
      }
    }

    // Filter matched beacons strictly to the dominant floor level
    const floorBeacons = matchedList.filter((m) => m.beacon.floorLevel === dominantFloorLevel);

    // Sort by RSSI descending (strongest beacon first)
    floorBeacons.sort((a, b) => b.rssi - a.rssi);

    const dominant = floorBeacons[0].beacon;
    const matchedDetails: MatchedBeaconDetail[] = [];

    // 4. Exact Indoor X/Y Coordinate Calculation
    let exactIndoorX: number;
    let exactIndoorY: number;
    let exactGeoLon: number;
    let exactGeoLat: number;
    let localizationMethod: 'nearest_proximity' | 'weighted_trilateration' | 'multi_beacon_centroid';
    let accuracyMeters: number;

    if (floorBeacons.length === 1) {
      // Single Beacon: Nearest Proximity Mapping
      localizationMethod = 'nearest_proximity';
      exactIndoorX = dominant.indoorX;
      exactIndoorY = dominant.indoorY;
      exactGeoLon = dominant.geographicLocation[0];
      exactGeoLat = dominant.geographicLocation[1];
      accuracyMeters = Math.max(1.5, floorBeacons[0].distanceMeters);

      matchedDetails.push({
        beaconId: dominant.beaconId,
        zone: dominant.zone,
        floorLevel: dominant.floorLevel,
        rssi: floorBeacons[0].rssi,
        estimatedDistanceMeters: floorBeacons[0].distanceMeters,
        indoorX: dominant.indoorX,
        indoorY: dominant.indoorY,
        weight: 1.0,
      });
    } else {
      // Multiple Beacons on Same Floor: Weighted Centroid Trilateration
      // Weight is inversely proportional to distance squared: w_i = 1 / (d_i + 0.1)^2
      localizationMethod = floorBeacons.length >= 3 ? 'weighted_trilateration' : 'multi_beacon_centroid';

      let sumWeights = 0;
      let weightedSumX = 0;
      let weightedSumY = 0;
      let weightedSumLon = 0;
      let weightedSumLat = 0;

      for (const item of floorBeacons) {
        const d = item.distanceMeters;
        const weight = 1 / Math.pow(d + 0.1, 2);

        sumWeights += weight;
        weightedSumX += item.beacon.indoorX * weight;
        weightedSumY += item.beacon.indoorY * weight;
        weightedSumLon += item.beacon.geographicLocation[0] * weight;
        weightedSumLat += item.beacon.geographicLocation[1] * weight;

        matchedDetails.push({
          beaconId: item.beacon.beaconId,
          zone: item.beacon.zone,
          floorLevel: item.beacon.floorLevel,
          rssi: item.rssi,
          estimatedDistanceMeters: d,
          indoorX: item.beacon.indoorX,
          indoorY: item.beacon.indoorY,
          weight: Number(weight.toFixed(4)),
        });
      }

      exactIndoorX = Number((weightedSumX / sumWeights).toFixed(2));
      exactIndoorY = Number((weightedSumY / sumWeights).toFixed(2));
      exactGeoLon = Number((weightedSumLon / sumWeights).toFixed(6));
      exactGeoLat = Number((weightedSumLat / sumWeights).toFixed(6));

      // Calculate precision accuracy based on average estimated distance / geometric spread
      const avgDistance =
        floorBeacons.reduce((acc, curr) => acc + curr.distanceMeters, 0) / floorBeacons.length;
      accuracyMeters = Number(Math.max(1.2, avgDistance / 2.0).toFixed(1));
    }

    const confidence = Number(
      Math.min(0.98, Math.max(0.7, 1.0 - accuracyMeters / 25.0)).toFixed(2)
    );

    const result: IndoorBeaconTranslationResult = {
      resolved: true,
      facilityId: dominant.facilityId,
      facilityName: dominant.facilityName,
      facilityType: dominant.facilityType,
      floorLevel: dominant.floorLevel,
      floorName: dominant.floorName,
      zone: dominant.zone,
      indoorCoordinates: {
        x: exactIndoorX,
        y: exactIndoorY,
        z: dominant.indoorZ ?? 2.5,
      },
      geographicCoordinates: [exactGeoLon, exactGeoLat],
      accuracyMeters,
      confidence,
      matchedBeaconsCount: floorBeacons.length,
      dominantBeaconId: dominant.beaconId,
      localizationMethod,
      matchedBeacons: matchedDetails,
      weakSignalContext: {
        isWeakGpsArea: true,
        gpsReplacedByIndoorMap: true,
        reason: `Weak GNSS signal in ${dominant.facilityType.replace('_', ' ')}. Precision positioning computed via ${floorBeacons.length} Bluetooth BLE beacons on ${dominant.floorName || `Floor ${dominant.floorLevel}`}.`,
      },
      timestamp: Date.now(),
    };

    logger.info(
      `📍 [INDOOR BEACON LOCALIZATION] Translated ${floorBeacons.length} BLE beacons -> Facility "${dominant.facilityName}", Floor ${dominant.floorLevel}: Indoor (X: ${exactIndoorX}m, Y: ${exactIndoorY}m), Accuracy: ${accuracyMeters}m`
    );

    return result;
  }

  /**
   * Retrieves all indoor beacons registered in the indoor mapping database.
   */
  async listIndoorBeacons(filter?: {
    facilityId?: string;
    floorLevel?: number;
    facilityType?: IndoorFacilityType;
  }): Promise<IndoorBeaconRecord[]> {
    let list = Array.from(this.beaconCache.values());

    if (filter?.facilityId) {
      list = list.filter((b) => b.facilityId === filter.facilityId);
    }
    if (filter?.floorLevel !== undefined) {
      list = list.filter((b) => b.floorLevel === filter.floorLevel);
    }
    if (filter?.facilityType) {
      list = list.filter((b) => b.facilityType === filter.facilityType);
    }

    return list;
  }

  /**
   * Retrieves a single indoor beacon by beaconId.
   */
  async getIndoorBeaconById(beaconId: string): Promise<IndoorBeaconRecord | null> {
    const cached = this.beaconCache.get(beaconId);
    if (cached) return cached;

    if (mongoose.connection.readyState === 1) {
      const found = await IndoorBeaconModel.findOne({ beaconId }).lean().exec();
      if (found) {
        return {
          ...found,
          geographicLocation: found.geographicLocation.coordinates as Coordinate,
        } as any;
      }
    }

    return null;
  }

  /**
   * Registers a new calibrated indoor beacon with exact X/Y coordinates in the indoor mapping database.
   */
  async registerIndoorBeacon(beacon: IndoorBeaconRecord): Promise<IndoorBeaconRecord> {
    this.beaconCache.set(beacon.beaconId, beacon);
    if (beacon.uuid && beacon.major !== undefined && beacon.minor !== undefined) {
      const key = `${beacon.uuid.toUpperCase()}:${beacon.major}:${beacon.minor}`;
      this.iBeaconIndex.set(key, beacon.beaconId);
    }

    if (mongoose.connection.readyState === 1) {
      await IndoorBeaconModel.findOneAndUpdate(
        { beaconId: beacon.beaconId },
        {
          ...beacon,
          geographicLocation: {
            type: 'Point',
            coordinates: beacon.geographicLocation,
          },
        },
        { upsert: true, new: true }
      );
    }

    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        await redis.setex(`beacon:id:${beacon.beaconId}`, 86400, JSON.stringify(beacon));
      }
    } catch {
      // Redis skip
    }

    logger.info(
      `📌 Registered indoor beacon "${beacon.beaconId}" in facility "${beacon.facilityName}" (Floor ${beacon.floorLevel}, X: ${beacon.indoorX}m, Y: ${beacon.indoorY}m)`
    );

    return beacon;
  }
}

export const indoorBeaconMappingService = new IndoorBeaconMappingService();
export const indoorBeaconEngineService = indoorBeaconMappingService;
