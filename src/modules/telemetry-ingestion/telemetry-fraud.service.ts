import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';
import { FraudEvaluationResult, TelemetryEvent } from './telemetry.types';

export class TelemetryFraudService {
  // Device previous battery cache: deviceId -> { batteryLevel, timestamp, isCharging }
  private memoryBatteryCache = new Map<
    string,
    { batteryLevel: number; timestamp: number; isCharging: boolean }
  >();

  // Known Android/iOS emulator hardware and build fingerprint markers
  private readonly EMULATOR_SIGNATURES = [
    'goldfish',
    'ranchu',
    'sdk_gphone',
    'vbox86p',
    'generic_x86',
    'simulator',
    'qemu',
    'android_x86',
    'nox',
    'bluestacks',
    'andy',
    'genymotion',
    'droid4x',
  ];

  // Timezone to expected UTC offset minutes and country code mapping
  private readonly TIMEZONE_REFERENCE_MAP: Record<string, { offsetMinutes: number; countryCode: string }> = {
    'asia/kolkata': { offsetMinutes: 330, countryCode: 'IN' },
    'asia/calcutta': { offsetMinutes: 330, countryCode: 'IN' },
    'america/new_york': { offsetMinutes: -300, countryCode: 'US' },
    'america/chicago': { offsetMinutes: -360, countryCode: 'US' },
    'america/denver': { offsetMinutes: -420, countryCode: 'US' },
    'america/los_angeles': { offsetMinutes: -480, countryCode: 'US' },
    'europe/london': { offsetMinutes: 0, countryCode: 'GB' },
    'europe/paris': { offsetMinutes: 60, countryCode: 'FR' },
    'europe/berlin': { offsetMinutes: 60, countryCode: 'DE' },
    'asia/dubai': { offsetMinutes: 240, countryCode: 'AE' },
    'asia/singapore': { offsetMinutes: 480, countryCode: 'SG' },
    'asia/tokyo': { offsetMinutes: 540, countryCode: 'JP' },
    'australia/sydney': { offsetMinutes: 600, countryCode: 'AU' },
  };

  /**
   * Evaluates fraud heuristics across a single telemetry event:
   * 1. Client-reported timezone vs IP geolocation / country headers
   * 2. Rapid changes in battery_level indicating an emulator
   * 3. Hardware fingerprint markers & zero-entropy IMU sensors
   * 4. Kinematic velocity anomalies
   */
  public async evaluateFraud(
    event: TelemetryEvent,
    requestHeaders?: Record<string, any>
  ): Promise<FraudEvaluationResult> {
    const reasons: string[] = [];
    let fraudScore = 0;
    const anomalies: FraudEvaluationResult['anomalies'] = {};

    // 1. Timezone vs IP Geolocation Mismatch Heuristic
    const timezoneCheck = this.evaluateTimezoneMismatch(event, requestHeaders);
    if (timezoneCheck.isMismatch) {
      fraudScore += 35;
      reasons.push(timezoneCheck.reason);
      anomalies.timezoneMismatch = timezoneCheck.details;
    }

    // 2. Battery Rapid Changes (Emulator Heuristic)
    const batteryCheck = await this.evaluateBatteryAnomalies(event);
    if (batteryCheck.isAnomalous) {
      fraudScore += 45;
      reasons.push(batteryCheck.reason);
      anomalies.batteryAnomaly = batteryCheck.details;
    }

    // 3. Hardware Emulator Fingerprint & Sensor Zero-Entropy
    const emulatorCheck = this.evaluateEmulatorHardware(event);
    if (emulatorCheck.isEmulator) {
      fraudScore += 50;
      reasons.push(emulatorCheck.reason);
      anomalies.emulatorHardware = emulatorCheck.details;
    }

    // 4. Kinematic Impossibility (Speed > 350 km/h without aircraft flag)
    const kinematicCheck = this.evaluateKinematicLimits(event);
    if (kinematicCheck.isImpossible) {
      fraudScore += 30;
      reasons.push(kinematicCheck.reason);
      anomalies.kinematicAnomaly = kinematicCheck.details;
    }

    const cappedScore = Math.min(100, fraudScore);
    const isFraudDetected = cappedScore >= 40;

    return {
      isFraudDetected,
      fraudScore: cappedScore,
      fraudReasons: reasons,
      anomalies,
    };
  }

  /**
   * Checks whether the client-reported timezone contradicts the IP geolocation or gateway country header.
   */
  private evaluateTimezoneMismatch(
    event: TelemetryEvent,
    headers?: Record<string, any>
  ): { isMismatch: boolean; reason: string; details?: any } {
    const clientTz = (event.clientTimezone || '').toLowerCase().trim();
    if (!clientTz) {
      return { isMismatch: false, reason: '' };
    }

    const ref = this.TIMEZONE_REFERENCE_MAP[clientTz];
    const ipCountry = (
      headers?.['cf-ipcountry'] ||
      headers?.['x-country-code'] ||
      headers?.['x-geo-country'] ||
      ''
    ).toString().toUpperCase().trim();

    // If reverse proxy / cloudflare provides country header, verify country match
    if (ipCountry && ref?.countryCode && ipCountry !== 'XX' && ipCountry !== 'T1') {
      if (ipCountry !== ref.countryCode) {
        return {
          isMismatch: true,
          reason: `Timezone/IP Mismatch: Client claims timezone '${event.clientTimezone}' (Country: ${ref.countryCode}), but IP originated from '${ipCountry}'`,
          details: {
            clientTimezone: event.clientTimezone,
            ipCountry,
            expectedCountry: ref.countryCode,
          },
        };
      }
    }

    return { isMismatch: false, reason: '' };
  }

  /**
   * Tracks battery changes per device over time.
   * Real Li-ion batteries cannot swing > 15% in <= 60 seconds.
   */
  private async evaluateBatteryAnomalies(
    event: TelemetryEvent
  ): Promise<{ isAnomalous: boolean; reason: string; details?: any }> {
    const currentBattery = event.metrics?.batteryLevel;
    if (currentBattery === undefined || currentBattery === null) {
      return { isAnomalous: false, reason: '' };
    }

    // Normalize battery to 0 - 100 percentage
    const normalizedBattery = currentBattery <= 1.0 ? currentBattery * 100 : currentBattery;
    const currentTimestamp = event.timestamp || Date.now();
    const deviceId = event.deviceId;

    const previous = await this.getPreviousBatteryState(deviceId);

    // Save current battery state for subsequent requests
    await this.saveBatteryState(deviceId, {
      batteryLevel: normalizedBattery,
      timestamp: currentTimestamp,
      isCharging: !!event.metrics?.isCharging,
    });

    if (!previous) {
      // Check static emulator battery traits
      if (
        normalizedBattery === 100 &&
        event.metrics?.batteryVoltage === 0 &&
        event.metrics?.batteryHealth === 'unknown'
      ) {
        return {
          isAnomalous: true,
          reason: 'Emulator Battery Signature: Static 100% with 0mV voltage and unknown battery health',
          details: {
            currentBatteryLevel: normalizedBattery,
            batteryHealth: event.metrics?.batteryHealth,
            batteryVoltage: event.metrics?.batteryVoltage,
            isEmulatorSignature: true,
          },
        };
      }
      return { isAnomalous: false, reason: '' };
    }

    const timeDeltaSeconds = Math.max(1, Math.round((currentTimestamp - previous.timestamp) / 1000));
    const deltaBattery = Math.abs(normalizedBattery - previous.batteryLevel);
    const ratePerMinute = (deltaBattery / timeDeltaSeconds) * 60;

    // A jump of >= 15% within 60 seconds indicates synthetic data / emulator state injection
    if (timeDeltaSeconds <= 60 && deltaBattery >= 15) {
      return {
        isAnomalous: true,
        reason: `Rapid Battery Jump (Emulator Heuristic): Battery level shifted by ${deltaBattery.toFixed(1)}% in ${timeDeltaSeconds}s (Rate: ${ratePerMinute.toFixed(1)}%/min)`,
        details: {
          previousBatteryLevel: previous.batteryLevel,
          currentBatteryLevel: normalizedBattery,
          timeDeltaSeconds,
          rateOfChangePerMinute: ratePerMinute,
          isEmulatorSignature: true,
        },
      };
    }

    return { isAnomalous: false, reason: '' };
  }

  /**
   * Detects emulator hardware strings, mock location flags, and zero-entropy IMU signatures.
   */
  private evaluateEmulatorHardware(
    event: TelemetryEvent
  ): { isEmulator: boolean; reason: string; details?: any } {
    const metrics = event.metrics || {};
    const reasons: string[] = [];
    const details: any = {};

    // 1. Explicit emulator flag reported by client runtime
    if (metrics.isEmulator === true) {
      reasons.push('Emulator Detected: Client explicitly reports isEmulator = true');
      details.isEmulatorFlag = true;
    }

    // 2. Hardware / Device Model / Board string matching
    const hardwareIdentity = [
      metrics.deviceModel,
      metrics.hardware,
      metrics.board,
      metrics.brand,
      metrics.bootloader,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    for (const signature of this.EMULATOR_SIGNATURES) {
      if (hardwareIdentity.includes(signature)) {
        reasons.push(`Emulator Hardware Fingerprint: Detected '${signature}' in device metadata (${hardwareIdentity})`);
        details.fingerprintMatched = signature;
        break;
      }
    }

    // 3. Mock Location Injection
    if (metrics.isMockLocation === true || metrics.mockProvider) {
      reasons.push(`Mock Location Injected: Device is spoofing GNSS coordinates via provider '${metrics.mockProvider || 'mock'}'`);
      details.isMockLocation = true;
      details.mockProvider = metrics.mockProvider;
    }

    // 4. Zero-Entropy IMU (Physical phones on Earth always report non-zero 1G gravity ~9.8m/s²)
    if (
      metrics.accelerometerX === 0 &&
      metrics.accelerometerY === 0 &&
      metrics.accelerometerZ === 0
    ) {
      reasons.push('Zero-Entropy IMU Sensor: Accelerometer reports exact 0,0,0 (missing gravity vector of physical device)');
      details.zeroEntropyImu = true;
    }

    return {
      isEmulator: reasons.length > 0,
      reason: reasons.join('; '),
      details,
    };
  }

  /**
   * Flags impossible kinematic speeds (> 350 km/h) for consumer road devices.
   */
  private evaluateKinematicLimits(
    event: TelemetryEvent
  ): { isImpossible: boolean; reason: string; details?: any } {
    const rawSpeed = event.metrics?.speed;
    if (rawSpeed === undefined || rawSpeed === null) {
      return { isImpossible: false, reason: '' };
    }

    // Convert to km/h if in m/s (usually < 100 is m/s in GPS NMEA)
    const speedKmh = rawSpeed < 100 ? rawSpeed * 3.6 : rawSpeed;

    if (speedKmh > 350) {
      return {
        isImpossible: true,
        reason: `Kinematic Impossibility: Vehicle speed reported as ${speedKmh.toFixed(1)} km/h (> 350 km/h physical cap)`,
        details: { impliedSpeedKmh: speedKmh, maxAllowedSpeedKmh: 350 },
      };
    }

    return { isImpossible: false, reason: '' };
  }

  private async getPreviousBatteryState(
    deviceId: string
  ): Promise<{ batteryLevel: number; timestamp: number; isCharging: boolean } | null> {
    const key = `telemetry:battery:${deviceId}`;

    if (isRedisConnected()) {
      try {
        const client = getRedisClient();
        const data = await client.get(key);
        if (data) return JSON.parse(data);
      } catch (err: any) {
        logger.debug(`Redis battery read error: ${err.message}`);
      }
    }

    return this.memoryBatteryCache.get(key) || null;
  }

  private async saveBatteryState(
    deviceId: string,
    state: { batteryLevel: number; timestamp: number; isCharging: boolean }
  ): Promise<void> {
    const key = `telemetry:battery:${deviceId}`;
    const ttlSeconds = 1800; // 30-minute rolling window

    if (isRedisConnected()) {
      try {
        const client = getRedisClient();
        await client.set(key, JSON.stringify(state), 'EX', ttlSeconds);
        return;
      } catch (err: any) {
        logger.debug(`Redis battery write error: ${err.message}`);
      }
    }

    this.memoryBatteryCache.set(key, state);
  }
}

export const telemetryFraudService = new TelemetryFraudService();
