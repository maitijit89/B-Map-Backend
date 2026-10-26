export type AppClientPlatform = 'web' | 'android' | 'ios' | 'desktop';

export interface AppVersionRecord {
  platform: AppClientPlatform;
  currentVersion: string; // e.g. '1.0.0'
  minimumSupportedVersion: string; // e.g. '1.0.0'
  latestBuildNumber: number; // e.g. 100
  minBuildNumber: number; // e.g. 90
  title: string;
  releaseNotes: string[];
  downloadUrl: string;
  forceUpdate: boolean;
  isMaintenance: boolean;
  maintenanceMessage?: string;
  patchBundleUrl?: string; // OTA delta patch URL for hot-reloading frontend web/bundle
  patchHash?: string; // SHA-256 integrity hash for patch verification
  patchSize?: number; // Size in bytes
  rolloutPercentage: number; // 0..100 (for phased/staged rollouts)
  metadata?: Record<string, any>;
  releasedAt: Date;
  updatedAt: Date;
}

export interface VersionCheckRequest {
  platform: AppClientPlatform;
  version: string; // e.g. '0.9.8'
  buildNumber?: number;
}

export interface VersionCheckResponse {
  updateAvailable: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  installedVersion: string;
  latestBuildNumber: number;
  installedBuildNumber?: number;
  downloadUrl: string;
  patchAvailable: boolean;
  patch?: {
    patchBundleUrl: string;
    patchHash?: string;
    patchSize?: number;
    fromVersion: string;
    toVersion: string;
  };
  title: string;
  releaseNotes: string[];
  isMaintenance: boolean;
  maintenanceMessage?: string;
}

export interface PatchVersionRequest {
  platform: AppClientPlatform;
  currentVersion: string; // e.g. '1.0.0'
  minimumSupportedVersion?: string;
  latestBuildNumber?: number;
  minBuildNumber?: number;
  title?: string;
  releaseNotes?: string[];
  downloadUrl?: string;
  forceUpdate?: boolean;
  patchBundleUrl?: string;
  patchHash?: string;
  patchSize?: number;
  rolloutPercentage?: number;
  isMaintenance?: boolean;
  maintenanceMessage?: string;
  metadata?: Record<string, any>;
  broadcastSocket?: boolean; // Emit live Socket.IO notification to all active clients
}
