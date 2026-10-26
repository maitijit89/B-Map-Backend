import mongoose from 'mongoose';
import { logger } from '../../core/config/logger';
import { SOCKET_EVENTS } from '../../core/constants/socket.events';
import { getIO } from '../../sockets';
import { AppVersionModel } from './app-version.model';
import {
  AppVersionRecord,
  AppClientPlatform,
  PatchVersionRequest,
  VersionCheckRequest,
  VersionCheckResponse,
} from './app-version.types';
import { VersionUtils } from './version.utils';

export class AppVersionService {
  // In-memory cache for ultra-low latency version verification
  private versionCache = new Map<AppClientPlatform, AppVersionRecord>();

  constructor() {
    this.seedDefaultPlatformVersions();
    this.syncFromDatabase().catch((err) => {
      logger.debug(`Database app version sync deferred: ${err.message}`);
    });
  }

  /**
   * Initializes default version configurations set to 1.0.0 across all platforms.
   */
  private seedDefaultPlatformVersions(): void {
    const platforms: AppClientPlatform[] = ['web', 'android', 'ios', 'desktop'];
    const now = new Date();

    for (const p of platforms) {
      this.versionCache.set(p, {
        platform: p,
        currentVersion: '1.0.0',
        minimumSupportedVersion: '1.0.0',
        latestBuildNumber: 100,
        minBuildNumber: 100,
        title: `B-Map Sovereign Platform v1.0.0 (${p.toUpperCase()})`,
        releaseNotes: [
          'Version 1.0.0 Sovereign Release',
          'Real-time crowdsourced traffic & dynamic ETA calculation',
          'Kinematic Extended Kalman Filter (EKF) motion fusion',
          'LWR macroscopic traffic flow shockwave & spillback prediction',
          'Zero-trust cryptographic telematics signing and anti-spoofing guard',
          'DigiPIN 4m x 4m hierarchical digital addressing',
        ],
        downloadUrl:
          p === 'android'
            ? 'https://play.google.com/store/apps/details?id=io.bmap.app'
            : p === 'ios'
            ? 'https://apps.apple.com/app/b-map/id123456789'
            : 'https://bmap.io',
        forceUpdate: false,
        isMaintenance: false,
        maintenanceMessage: '',
        patchBundleUrl: p === 'web' ? 'https://cdn.bmap.io/bundles/web/v1.0.0/main.bundle.js' : '',
        patchHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        patchSize: 485200,
        rolloutPercentage: 100,
        metadata: {
          runtime: 'react-vite',
          serviceWorkerCacheVersion: 'bmap-v1.0.0',
        },
        releasedAt: now,
        updatedAt: now,
      });
    }
  }

  /**
   * Checks installed frontend/client version against active server release.
   */
  public checkClientVersion(req: VersionCheckRequest): VersionCheckResponse {
    const platform = (req.platform || 'web').toLowerCase() as AppClientPlatform;
    const record = this.versionCache.get(platform) || this.versionCache.get('web')!;
    const installed = req.version || '0.9.0';
    const installedBuild = req.buildNumber || 90;

    // 1. Semver & build comparisons
    const updateAvailable =
      VersionUtils.isOutdated(installed, record.currentVersion) ||
      (installedBuild < record.latestBuildNumber && record.currentVersion === installed);

    const forceUpdate =
      record.forceUpdate ||
      VersionUtils.isForceUpdateRequired(installed, record.minimumSupportedVersion) ||
      installedBuild < record.minBuildNumber;

    // 2. Check if OTA delta patch is available for hot-reloading frontend web/bundle
    const patchAvailable =
      updateAvailable &&
      !!record.patchBundleUrl &&
      record.patchBundleUrl.length > 0;

    return {
      updateAvailable,
      forceUpdate,
      currentVersion: record.currentVersion,
      installedVersion: installed,
      latestBuildNumber: record.latestBuildNumber,
      installedBuildNumber: installedBuild,
      downloadUrl: record.downloadUrl,
      patchAvailable,
      patch: patchAvailable
        ? {
            patchBundleUrl: record.patchBundleUrl!,
            patchHash: record.patchHash,
            patchSize: record.patchSize,
            fromVersion: installed,
            toVersion: record.currentVersion,
          }
        : undefined,
      title: record.title,
      releaseNotes: record.releaseNotes,
      isMaintenance: record.isMaintenance,
      maintenanceMessage: record.isMaintenance ? record.maintenanceMessage : undefined,
    };
  }

  /**
   * Patches frontend version configuration via API:
   * Updates version strings, force update flags, release notes, and OTA patch bundles.
   * Immediately broadcasts WebSocket event to all connected frontends to trigger live reload!
   */
  public async patchAppVersion(req: PatchVersionRequest): Promise<AppVersionRecord> {
    const platform = (req.platform || 'web').toLowerCase() as AppClientPlatform;
    const existing = this.versionCache.get(platform) || this.versionCache.get('web')!;
    const now = new Date();

    const updatedRecord: AppVersionRecord = {
      ...existing,
      platform,
      currentVersion: req.currentVersion || existing.currentVersion,
      minimumSupportedVersion: req.minimumSupportedVersion || req.currentVersion || existing.minimumSupportedVersion,
      latestBuildNumber: req.latestBuildNumber !== undefined ? req.latestBuildNumber : existing.latestBuildNumber + 1,
      minBuildNumber: req.minBuildNumber !== undefined ? req.minBuildNumber : existing.minBuildNumber,
      title: req.title || `B-Map Release v${req.currentVersion || existing.currentVersion}`,
      releaseNotes: req.releaseNotes || existing.releaseNotes,
      downloadUrl: req.downloadUrl || existing.downloadUrl,
      forceUpdate: req.forceUpdate !== undefined ? req.forceUpdate : existing.forceUpdate,
      patchBundleUrl: req.patchBundleUrl !== undefined ? req.patchBundleUrl : existing.patchBundleUrl,
      patchHash: req.patchHash !== undefined ? req.patchHash : existing.patchHash,
      patchSize: req.patchSize !== undefined ? req.patchSize : existing.patchSize,
      rolloutPercentage: req.rolloutPercentage !== undefined ? req.rolloutPercentage : 100,
      isMaintenance: req.isMaintenance !== undefined ? req.isMaintenance : existing.isMaintenance,
      maintenanceMessage: req.maintenanceMessage !== undefined ? req.maintenanceMessage : existing.maintenanceMessage,
      metadata: { ...existing.metadata, ...req.metadata },
      updatedAt: now,
      releasedAt: req.currentVersion !== existing.currentVersion ? now : existing.releasedAt,
    };

    // 1. Update in-memory cache
    this.versionCache.set(platform, updatedRecord);

    // 2. Persist to MongoDB (Upsert) if active database connection exists
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        await AppVersionModel.findOneAndUpdate(
          { platform },
          { $set: updatedRecord },
          { upsert: true, returnDocument: 'after' }
        );
      } catch (err: any) {
        logger.warn(`Failed persisting patched app version to MongoDB: ${err.message}`);
      }
    }

    // 3. Broadcast real-time Socket.IO notification to all active web & mobile frontends
    if (req.broadcastSocket !== false) {
      this.broadcastVersionUpdate(updatedRecord);
    }

    logger.info(`🚀 [APP VERSION] Patched ${platform} version to v${updatedRecord.currentVersion} (Build ${updatedRecord.latestBuildNumber})`);

    return updatedRecord;
  }

  /**
   * Broadcasts real-time version update notification across Socket.IO.
   */
  public broadcastVersionUpdate(record: AppVersionRecord): void {
    try {
      const io = getIO();
      io.emit(SOCKET_EVENTS.APP_VERSION_UPDATE_AVAILABLE, {
        platform: record.platform,
        currentVersion: record.currentVersion,
        latestBuildNumber: record.latestBuildNumber,
        forceUpdate: record.forceUpdate,
        patchAvailable: !!record.patchBundleUrl,
        patchBundleUrl: record.patchBundleUrl,
        patchHash: record.patchHash,
        title: record.title,
        releaseNotes: record.releaseNotes,
        timestamp: Date.now(),
      });
      logger.info(`📡 [SOCKET BROADCAST] Pushed app version update v${record.currentVersion} to active frontend clients`);
    } catch {
      // Socket.IO may not be bound in offline test mode
    }
  }

  /**
   * Retrieves latest version records across all supported platforms.
   */
  public getAllPlatformsLatest(): AppVersionRecord[] {
    return Array.from(this.versionCache.values());
  }

  /**
   * Syncs existing configurations from MongoDB on initialization.
   */
  private async syncFromDatabase(): Promise<void> {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return;
    }
    try {
      const docs = await AppVersionModel.find().lean();
      for (const doc of docs) {
        this.versionCache.set(doc.platform as AppClientPlatform, {
          platform: doc.platform as AppClientPlatform,
          currentVersion: doc.currentVersion,
          minimumSupportedVersion: doc.minimumSupportedVersion,
          latestBuildNumber: doc.latestBuildNumber,
          minBuildNumber: doc.minBuildNumber,
          title: doc.title,
          releaseNotes: doc.releaseNotes,
          downloadUrl: doc.downloadUrl,
          forceUpdate: doc.forceUpdate,
          isMaintenance: doc.isMaintenance,
          maintenanceMessage: doc.maintenanceMessage,
          patchBundleUrl: doc.patchBundleUrl,
          patchHash: doc.patchHash,
          patchSize: doc.patchSize,
          rolloutPercentage: doc.rolloutPercentage,
          metadata: doc.metadata,
          releasedAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        });
      }
    } catch (err: any) {
      logger.debug(`No previous app version records loaded from MongoDB: ${err.message}`);
    }
  }
}

export const appVersionService = new AppVersionService();
