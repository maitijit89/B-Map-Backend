import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../core/utils/api-response';
import { env } from '../../core/config/env.config';
import { appVersionService } from './app-version.service';
import { AppClientPlatform, PatchVersionRequest, VersionCheckRequest } from './app-version.types';

export class AppVersionController {
  /**
   * GET /api/v1/app-version/check
   * Evaluates installed frontend / mobile client version against current server release.
   * Supports both query params (GET) and body payloads (POST).
   */
  async checkVersion(req: Request, res: Response): Promise<void> {
    try {
      const platform = (req.query.platform || req.body?.platform || 'web') as AppClientPlatform;
      const version = (req.query.version || req.body?.version || '1.0.0') as string;
      const rawBuild = req.query.buildNumber || req.body?.buildNumber;
      const buildNumber = rawBuild !== undefined ? parseInt(String(rawBuild), 10) : undefined;

      const checkPayload: VersionCheckRequest = {
        platform,
        version,
        buildNumber: isNaN(buildNumber as number) ? undefined : buildNumber,
      };

      const result = appVersionService.checkClientVersion(checkPayload);

      sendSuccess({
        res,
        statusCode: 200,
        message: result.updateAvailable
          ? result.forceUpdate
            ? 'Critical mandatory update required to proceed'
            : 'A newer application release or hot-patch is available'
          : 'Frontend client is currently up to date',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 500, `Failed evaluating client version: ${error.message}`);
    }
  }

  /**
   * GET /api/v1/app-version/current
   * Returns authoritative backend sovereign version (1.0.0).
   */
  async getCurrent(req: Request, res: Response): Promise<void> {
    try {
      sendSuccess({
        res,
        statusCode: 200,
        message: 'Current authoritative backend version retrieved',
        data: {
          appVersion: env.APP_VERSION || '1.0.0',
          environment: env.NODE_ENV,
          service: 'B-Map Sovereign Geospatial Platform',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      sendError(res, 500, `Failed retrieving server version: ${error.message}`);
    }
  }

  /**
   * GET /api/v1/app-version/latest
   * Returns active version specifications and patch releases across all platforms (web, android, ios, desktop).
   */
  async getLatestPlatforms(req: Request, res: Response): Promise<void> {
    try {
      const records = appVersionService.getAllPlatformsLatest();
      sendSuccess({
        res,
        statusCode: 200,
        message: 'Retrieved latest release records for all client platforms',
        data: {
          serverVersion: env.APP_VERSION || '1.0.0',
          platforms: records,
        },
      });
    } catch (error: any) {
      sendError(res, 500, `Failed retrieving latest platform releases: ${error.message}`);
    }
  }

  /**
   * PATCH /api/v1/app-version/patch
   * Dynamically patches client version metadata and OTA hot-reload bundle URLs via API.
   * Emits instant Socket.IO broadcast to all connected frontends to trigger live update.
   */
  async patchVersion(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as PatchVersionRequest;

      if (!body) {
        sendError(res, 400, 'Request body is required');
        return;
      }

      const platform: AppClientPlatform = body.platform ? (body.platform.toLowerCase() as AppClientPlatform) : 'web';
      const validPlatforms: AppClientPlatform[] = ['web', 'android', 'ios', 'desktop'];
      if (!validPlatforms.includes(platform)) {
        sendError(res, 400, `Invalid platform "${body.platform}". Must be one of: ${validPlatforms.join(', ')}`);
        return;
      }

      const updated = await appVersionService.patchAppVersion({
        ...body,
        platform,
      });

      sendSuccess({
        res,
        statusCode: 200,
        message: `Frontend ${platform} version successfully patched to v${updated.currentVersion}`,
        data: updated,
      });
    } catch (error: any) {
      sendError(res, 500, `Failed patching app version: ${error.message}`);
    }
  }

  /**
   * POST /api/v1/app-version/broadcast
   * Manually broadcasts the latest version update notice over Socket.IO.
   */
  async broadcastUpdate(req: Request, res: Response): Promise<void> {
    try {
      const platform = (req.body?.platform || 'web').toLowerCase() as AppClientPlatform;
      const records = appVersionService.getAllPlatformsLatest();
      const target = records.find((r) => r.platform === platform) || records[0];

      appVersionService.broadcastVersionUpdate(target);

      sendSuccess({
        res,
        statusCode: 200,
        message: `Broadcasted v${target.currentVersion} update notice for platform ${platform} across WebSockets`,
        data: {
          platform,
          version: target.currentVersion,
          patchAvailable: !!target.patchBundleUrl,
        },
      });
    } catch (error: any) {
      sendError(res, 500, `Failed broadcasting version update: ${error.message}`);
    }
  }
}

export const appVersionController = new AppVersionController();
