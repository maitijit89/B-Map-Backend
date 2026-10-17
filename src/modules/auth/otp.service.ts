import crypto from 'crypto';
import { env } from '../../core/config/env.config';
import { logger } from '../../core/config/logger';
import { getRedisClient, isRedisConnected } from '../../core/config/redis';

interface OtpRecord {
  otp: string;
  attempts: number;
  createdAt: number;
}

export class OtpService {
  // In-memory fallback if Redis is temporarily unavailable
  private memoryOtpStore = new Map<string, OtpRecord>();
  private resendCooldownMap = new Map<string, number>();

  /**
   * Generates a secure 6-digit numeric OTP.
   */
  generateOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Formats the Redis cache key for OTP records.
   */
  private getCacheKey(email: string, type: 'registration' | 'login'): string {
    return `otp:${type}:${email.trim().toLowerCase()}`;
  }

  /**
   * Checks whether the user can request a new OTP (30s cooldown).
   */
  checkResendCooldown(email: string, type: 'registration' | 'login'): { canResend: boolean; waitSeconds: number } {
    const key = `${type}:${email.trim().toLowerCase()}`;
    const lastSent = this.resendCooldownMap.get(key);
    if (!lastSent) {
      return { canResend: true, waitSeconds: 0 };
    }

    const elapsedSeconds = Math.floor((Date.now() - lastSent) / 1000);
    const cooldownSeconds = 30; // 30-second cooldown between resends

    if (elapsedSeconds < cooldownSeconds) {
      return { canResend: false, waitSeconds: cooldownSeconds - elapsedSeconds };
    }

    return { canResend: true, waitSeconds: 0 };
  }

  /**
   * Saves an OTP with expiration time in Redis (or in-memory fallback).
   */
  async saveOtp(email: string, type: 'registration' | 'login', otp: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const key = this.getCacheKey(normalizedEmail, type);
    const ttlSeconds = env.OTP_EXPIRY_MINUTES * 60;

    const record: OtpRecord = {
      otp,
      attempts: 0,
      createdAt: Date.now(),
    };

    // Track cooldown
    this.resendCooldownMap.set(`${type}:${normalizedEmail}`, Date.now());

    // Try storing in Redis
    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        await client.setex(key, ttlSeconds, JSON.stringify(record));
        logger.debug(`Saved OTP in Redis for [${key}], TTL: ${ttlSeconds}s`);
        return;
      }
    } catch (err: any) {
      logger.warn(`Redis save error for OTP (${err.message}). Using in-memory fallback.`);
    }

    // Fallback in-memory storage
    this.memoryOtpStore.set(key, record);
    setTimeout(() => {
      this.memoryOtpStore.delete(key);
    }, ttlSeconds * 1000);
  }

  /**
   * Validates an OTP code entered by the user.
   */
  async verifyOtp(email: string, type: 'registration' | 'login', inputOtp: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    const key = this.getCacheKey(normalizedEmail, type);

    let record: OtpRecord | null = null;

    // Fetch from Redis if connected
    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        const data = await client.get(key);
        if (data) {
          record = JSON.parse(data) as OtpRecord;
        }
      }
    } catch (err: any) {
      logger.warn(`Redis fetch error for OTP (${err.message}). Checking in-memory store.`);
    }

    // Fallback to in-memory store if not found in Redis
    if (!record) {
      record = this.memoryOtpStore.get(key) || null;
    }

    if (!record) {
      throw new Error('OTP has expired or was not requested. Please request a new passcode.');
    }

    // Check attempts
    if (record.attempts >= 3) {
      await this.deleteOtp(normalizedEmail, type);
      throw new Error('Too many invalid attempts. For your security, this passcode has been invalidated.');
    }

    // Verify OTP match using constant-time comparison to eliminate side-channel timing attacks
    const expectedBuffer = Buffer.from(record.otp);
    const inputBuffer = Buffer.from(inputOtp.trim());
    const isMatch =
      expectedBuffer.length === inputBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, inputBuffer);

    if (!isMatch) {
      record.attempts += 1;

      // Update attempt count in Redis / Memory
      try {
        if (isRedisConnected()) {
          const client = getRedisClient();
          const ttl = await client.ttl(key);
          if (ttl > 0) {
            await client.setex(key, ttl, JSON.stringify(record));
          }
        }
      } catch (e) {
        // Ignored
      }
      this.memoryOtpStore.set(key, record);

      const remaining = 3 - record.attempts;
      throw new Error(`Incorrect passcode. You have ${remaining} attempt(s) remaining.`);
    }

    // OTP matched - delete to prevent replay attacks
    await this.deleteOtp(normalizedEmail, type);
    return true;
  }

  /**
   * Deletes an OTP from storage.
   */
  async deleteOtp(email: string, type: 'registration' | 'login'): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const key = this.getCacheKey(normalizedEmail, type);

    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        await client.del(key);
      }
    } catch (err: any) {
      logger.warn(`Redis del error for OTP: ${err.message}`);
    }

    this.memoryOtpStore.delete(key);
  }
}

export const otpService = new OtpService();
