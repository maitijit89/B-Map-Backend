import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../core/config/env.config';
import { logger } from '../../core/config/logger';

export interface JwtUserPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  name: string;
}

export class JwtService {
  private secret: string;
  private expiryHours: number;

  constructor() {
    this.secret = env.JWT_SECRET;
    this.expiryHours = env.JWT_EXPIRY_HOURS;
  }

  /**
   * Generates a signed JWT authentication token for a user.
   */
  generateToken(payload: JwtUserPayload): string {
    const options: SignOptions = {
      expiresIn: `${this.expiryHours}h`,
      issuer: env.APP_NAME,
      audience: 'b-map-client',
    };

    return jwt.sign(payload, this.secret, options);
  }

  /**
   * Verifies and decodes a JWT token.
   */
  verifyToken(token: string): JwtUserPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: env.APP_NAME,
        audience: 'b-map-client',
      }) as JwtUserPayload;

      return decoded;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Authentication token has expired. Please log in again.');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid authentication token.');
      }
      throw new Error(`Authentication failure: ${error.message}`);
    }
  }
}

export const jwtService = new JwtService();
