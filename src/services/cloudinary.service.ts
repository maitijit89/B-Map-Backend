import crypto from 'crypto';
import { env } from '../core/config/env.config';
import { logger } from '../core/config/logger';

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  format: string;
  bytes: number;
  folder: string;
  createdAt: string;
}

export class CloudinaryService {
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;
  private defaultFolder: string;

  constructor() {
    this.cloudName = env.CLOUDINARY_CLOUD_NAME;
    this.apiKey = env.CLOUDINARY_API_KEY;
    this.apiSecret = env.CLOUDINARY_API_SECRET;
    this.defaultFolder = env.CLOUDINARY_FOLDER;
  }

  /**
   * Generates SHA-1 signature for secure direct client uploads to Cloudinary.
   */
  generateUploadSignature(paramsToSign: Record<string, any>): {
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder: string;
  } {
    const timestamp = Math.round(Date.now() / 1000);
    const params: Record<string, any> = {
      ...paramsToSign,
      folder: paramsToSign.folder || this.defaultFolder,
      timestamp,
    };

    // Sort parameters alphabetically
    const sortedKeys = Object.keys(params).sort();
    const serialized = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');

    const signature = crypto
      .createHash('sha1')
      .update(serialized + this.apiSecret)
      .digest('hex');

    return {
      signature,
      timestamp,
      apiKey: this.apiKey,
      cloudName: this.cloudName,
      folder: params.folder,
    };
  }

  /**
   * Generates optimized Cloudinary delivery CDN URL with auto-format and quality compression.
   */
  getOptimizedUrl(
    publicId: string,
    transformations: { width?: number; height?: number; crop?: string } = {}
  ): string {
    const transforms = ['f_auto', 'q_auto'];
    if (transformations.width) transforms.push(`w_${transformations.width}`);
    if (transformations.height) transforms.push(`h_${transformations.height}`);
    if (transformations.crop) transforms.push(`c_${transformations.crop}`);

    const transformStr = transforms.join(',');
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transformStr}/${publicId}`;
  }

  /**
   * Validates configured credentials.
   */
  isConfigured(): boolean {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  }
}

export const cloudinaryService = new CloudinaryService();
