import { Request, Response } from 'express';
import { env } from '../../core/config/env.config';
import { sendBadRequest, sendNotFound, sendSuccess } from '../../core/utils/response';
import { ratingService } from '../ratings/ratings.service';
import { weatherService } from '../weather/weather.service';
import { getAdminDashboardHtml } from './admin.dashboard.view';
import { adminService } from './admin.service';

export class AdminController {
  private getActorEmail(req: Request): string {
    return (req as any).user?.email || env.ADMIN_EMAIL;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
  }

  // ==========================================
  // DASHBOARD WEB UI
  // ==========================================

  public async getDashboard(_req: Request, res: Response): Promise<void> {
    const html = getAdminDashboardHtml(env.API_PREFIX);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  // ==========================================
  // OVERVIEW & ANALYTICS
  // ==========================================

  public async getOverview(_req: Request, res: Response): Promise<void> {
    try {
      const metrics = await adminService.getOverviewMetrics();
      sendSuccess(res, metrics, 'Admin overview metrics retrieved');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to retrieve overview metrics');
    }
  }

  public async getUserAnalytics(_req: Request, res: Response): Promise<void> {
    const graph = adminService.getUserAnalyticsGraph();
    sendSuccess(res, graph, 'Daily/Monthly active user analytics graph retrieved');
  }

  public async getFeatureUsage(_req: Request, res: Response): Promise<void> {
    const graph = adminService.getFeatureUsageGraph();
    sendSuccess(res, graph, 'Feature usage analytics graph retrieved');
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  public async listUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = req.query.search as string;
      const role = req.query.role as string;
      let isEmailVerified: boolean | undefined = undefined;
      if (req.query.isEmailVerified !== undefined) {
        isEmailVerified = req.query.isEmailVerified === 'true';
      }
      const sortBy = (req.query.sortBy as any) || 'createdAt';
      const sortOrder = (req.query.sortOrder as any) || 'desc';

      const result = await adminService.listUsers(
        page,
        limit,
        search,
        role,
        isEmailVerified,
        sortBy,
        sortOrder
      );

      sendSuccess(res, result, 'Registered users directory retrieved');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to list users');
    }
  }

  public async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const user = await adminService.getUserById(id);
      if (!user) {
        sendNotFound(res, `User with ID '${id}' not found`);
        return;
      }
      sendSuccess(res, user, 'User details retrieved');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to get user details');
    }
  }

  public async createUser(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, phoneNumber, age, role, isEmailVerified } = req.body;
      if (!name || !email) {
        sendBadRequest(res, 'Name and email are required fields');
        return;
      }

      const user = await adminService.createUser(
        {
          name,
          email,
          phoneNumber: phoneNumber || '',
          age: age || 25,
          role,
          isEmailVerified,
        },
        this.getActorEmail(req),
        this.getClientIp(req)
      );

      sendSuccess(res, user, 'User created successfully', 201);
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to create user');
    }
  }

  public async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const user = await adminService.updateUser(
        id,
        req.body,
        this.getActorEmail(req),
        this.getClientIp(req)
      );
      sendSuccess(res, user, 'User profile updated successfully');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to update user');
    }
  }

  public async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const deleted = await adminService.deleteUser(
        id,
        this.getActorEmail(req),
        this.getClientIp(req)
      );
      if (!deleted) {
        sendNotFound(res, `User with ID '${id}' not found`);
        return;
      }
      sendSuccess(res, { deleted: true }, `User '${id}' deleted`);
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to delete user');
    }
  }

  public async getUserStats(_req: Request, res: Response): Promise<void> {
    try {
      const summary = await adminService.getUserStatsSummary();
      sendSuccess(res, summary, 'User directory statistics summary retrieved');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to get user stats');
    }
  }

  public async getActiveUsers(_req: Request, res: Response): Promise<void> {
    const users = adminService.getActiveUsers();
    sendSuccess(res, users, 'Active online users retrieved');
  }

  // ==========================================
  // SYSTEM HEALTH, DIAGNOSTICS & CACHE
  // ==========================================

  public async getSystemHealth(_req: Request, res: Response): Promise<void> {
    try {
      const health = await adminService.getSystemHealth();
      sendSuccess(res, health, 'System diagnostics and health report retrieved');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to retrieve system health');
    }
  }

  public async getCacheStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await adminService.getCacheStats();
      sendSuccess(res, stats, 'Redis cache stats retrieved');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to get cache stats');
    }
  }

  public async flushCache(req: Request, res: Response): Promise<void> {
    try {
      const type = req.body?.type === 'all' ? 'all' : 'routes';
      const result = await adminService.flushCache(
        type,
        this.getActorEmail(req),
        this.getClientIp(req)
      );
      sendSuccess(res, result, `Cache successfully flushed (${type})`);
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to flush cache');
    }
  }

  // ==========================================
  // CONFIGURATION & FEATURE FLAGS
  // ==========================================

  public async getSystemConfig(_req: Request, res: Response): Promise<void> {
    try {
      const config = await adminService.getSystemConfig();
      sendSuccess(res, config, 'Dynamic system configuration retrieved');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to get system configuration');
    }
  }

  public async updateSystemConfig(req: Request, res: Response): Promise<void> {
    try {
      const updated = await adminService.updateSystemConfig(
        req.body,
        this.getActorEmail(req),
        this.getClientIp(req)
      );
      sendSuccess(res, updated, 'Dynamic system configuration updated');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to update system configuration');
    }
  }

  // ==========================================
  // TRAFFIC OVERRIDES
  // ==========================================

  public async getTrafficOverrides(_req: Request, res: Response): Promise<void> {
    const list = adminService.getTrafficOverrides();
    sendSuccess(res, list, 'Active traffic overrides retrieved');
  }

  public async setTrafficOverride(req: Request, res: Response): Promise<void> {
    try {
      const saved = adminService.setTrafficOverride(
        req.body,
        this.getActorEmail(req),
        this.getClientIp(req)
      );
      sendSuccess(res, saved, 'Traffic override injected successfully');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to set traffic override');
    }
  }

  public async deleteTrafficOverride(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const deleted = adminService.deleteTrafficOverride(
      id,
      this.getActorEmail(req),
      this.getClientIp(req)
    );
    sendSuccess(res, { deleted }, `Traffic override '${id}' removed`);
  }

  // ==========================================
  // WEATHER OVERRIDES
  // ==========================================

  public async getWeatherOverrides(_req: Request, res: Response): Promise<void> {
    const list = weatherService.getActiveOverrides();
    sendSuccess(res, list, 'Active weather overrides retrieved');
  }

  public async setWeatherOverride(req: Request, res: Response): Promise<void> {
    try {
      const saved = weatherService.setManualOverride({
        ...req.body,
        highway_name: req.body.highway_name ?? 'Yamuna Expressway',
      });
      await adminService.logAction(
        this.getActorEmail(req),
        'WEATHER_OVERRIDE_SET',
        'WEATHER_ADVISORY',
        saved.highway_name,
        saved,
        this.getClientIp(req)
      );
      sendSuccess(res, saved, 'Weather override injected successfully');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to set weather override');
    }
  }

  public async deleteWeatherOverride(req: Request, res: Response): Promise<void> {
    const name = String(req.params.name);
    const deleted = weatherService.deleteOverride(name);
    if (deleted) {
      await adminService.logAction(
        this.getActorEmail(req),
        'WEATHER_OVERRIDE_DELETED',
        'WEATHER_ADVISORY',
        name,
        {},
        this.getClientIp(req)
      );
    }
    sendSuccess(res, { deleted }, `Weather override for '${name}' removed`);
  }

  // ==========================================
  // ROAD HAZARDS
  // ==========================================

  public async listHazards(_req: Request, res: Response): Promise<void> {
    const list = adminService.listHazards();
    sendSuccess(res, list, 'Road hazards retrieved');
  }

  public async createHazard(req: Request, res: Response): Promise<void> {
    try {
      const created = adminService.createHazard(
        req.body,
        this.getActorEmail(req),
        this.getClientIp(req)
      );
      sendSuccess(res, created, 'Road hazard alert created successfully', 201);
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to create hazard');
    }
  }

  public async verifyHazard(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const verified = adminService.verifyHazard(
      id,
      this.getActorEmail(req),
      this.getClientIp(req)
    );
    if (!verified) {
      sendNotFound(res, `Hazard with ID '${id}' not found`);
      return;
    }
    sendSuccess(res, verified, `Hazard '${id}' verified`);
  }

  public async deleteHazard(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const deleted = adminService.deleteHazard(
      id,
      this.getActorEmail(req),
      this.getClientIp(req)
    );
    sendSuccess(res, { deleted }, `Hazard '${id}' removed`);
  }

  // ==========================================
  // TOLL PLAZAS
  // ==========================================

  public async listTolls(req: Request, res: Response): Promise<void> {
    const list = adminService.listTollPlazas(req.query as any);
    sendSuccess(res, list, 'Toll plazas registry retrieved');
  }

  public async createToll(req: Request, res: Response): Promise<void> {
    try {
      const created = adminService.createTollPlaza(
        req.body,
        this.getActorEmail(req),
        this.getClientIp(req)
      );
      sendSuccess(res, created, 'Toll plaza added successfully', 201);
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to create toll plaza');
    }
  }

  public async updateToll(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const updated = adminService.updateTollPlaza(
      id,
      req.body,
      this.getActorEmail(req),
      this.getClientIp(req)
    );
    if (!updated) {
      sendNotFound(res, `Toll plaza '${id}' not found`);
      return;
    }
    sendSuccess(res, updated, 'Toll plaza rates and details updated');
  }

  public async deleteToll(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const deleted = adminService.deleteTollPlaza(
      id,
      this.getActorEmail(req),
      this.getClientIp(req)
    );
    sendSuccess(res, { deleted }, `Toll plaza '${id}' removed`);
  }

  // ==========================================
  // PLACES / POIs
  // ==========================================

  public async listPlaces(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const category = req.query.category as string;
      const search = req.query.search as string;

      const result = await adminService.listPlaces(page, limit, category, search);
      sendSuccess(res, result, 'Points of interest retrieved');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to list places');
    }
  }

  public async createPlace(req: Request, res: Response): Promise<void> {
    try {
      const created = await adminService.createPlace(
        req.body,
        this.getActorEmail(req),
        this.getClientIp(req)
      );
      sendSuccess(res, created, 'Point of interest created successfully', 201);
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to create POI');
    }
  }

  public async deletePlace(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const deleted = await adminService.deletePlace(
        id,
        this.getActorEmail(req),
        this.getClientIp(req)
      );
      sendSuccess(res, { deleted }, `POI '${id}' deleted`);
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to delete POI');
    }
  }

  // ==========================================
  // SOS EMERGENCY INCIDENTS
  // ==========================================

  public async listSOSIncidents(req: Request, res: Response): Promise<void> {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const incidents = adminService.listSOSIncidents(limit);
    sendSuccess(res, incidents, 'Highway SOS emergency incidents retrieved');
  }

  public async updateSOSIncident(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const { status, notes } = req.body;
    const updated = adminService.updateSOSIncidentStatus(
      id,
      status || 'RESOLVED',
      notes,
      this.getActorEmail(req),
      this.getClientIp(req)
    );
    if (!updated) {
      sendNotFound(res, `SOS incident '${id}' not found`);
      return;
    }
    sendSuccess(res, updated, `SOS Incident status updated to ${status}`);
  }

  // ==========================================
  // RATINGS MODERATION
  // ==========================================

  public async getRatings(req: Request, res: Response): Promise<void> {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const ratings = ratingService.listRatings(limit);
    sendSuccess(res, ratings, 'User ratings feed retrieved for moderation');
  }

  public async deleteRating(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id);
    const deleted = adminService.deleteRating(
      id,
      this.getActorEmail(req),
      this.getClientIp(req)
    );
    sendSuccess(res, { deleted }, `Rating '${id}' removed`);
  }

  // ==========================================
  // AUDIT LOGS
  // ==========================================

  public async listAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const action = req.query.action as string;
      const logs = await adminService.listAuditLogs(limit, action);
      sendSuccess(res, logs, 'Administrative audit logs retrieved');
    } catch (err: any) {
      sendBadRequest(res, err.message || 'Failed to retrieve audit logs');
    }
  }
}

export const adminController = new AdminController();
