import { Request, Response } from 'express';
import { poiResolutionService } from './poi-resolution.service';
import { roadProductionService } from './road-production.service';
import { trajectoryMiningService } from './trajectory-mining.service';
import { RawCandidatePoi, TrajectoryPoint } from './data-mining.types';
import { sendError, sendSuccess } from '../../core/utils/api-response';

export class AiDataMiningController {
  /**
   * POST /api/v1/data-mining/trajectories/mine-staypoints
   * Extract stay points and cluster frequent hotspots using ST-DBSCAN
   */
  async mineStayPoints(req: Request, res: Response): Promise<void> {
    try {
      const { points, minDurationSeconds, maxDistanceMeters, epsDistanceMeters } = req.body;

      if (!Array.isArray(points) || points.length === 0) {
        sendError(res, 400, 'points array of trajectory coordinates is required');
        return;
      }

      const stayPoints = trajectoryMiningService.extractStayPoints(
        points as TrajectoryPoint[],
        minDurationSeconds ? parseInt(minDurationSeconds, 10) : 300,
        maxDistanceMeters ? parseFloat(maxDistanceMeters) : 50
      );

      const clusters = trajectoryMiningService.clusterStayPoints(
        stayPoints,
        epsDistanceMeters ? parseFloat(epsDistanceMeters) : 40,
        2
      );

      const entrances = trajectoryMiningService.mineEntrances(stayPoints);

      sendSuccess({
        res,
        message: `Extracted ${stayPoints.length} stay points and ${clusters.length} visit clusters`,
        data: {
          totalStayPoints: stayPoints.length,
          stayPoints,
          clustersCount: clusters.length,
          candidateHotspots: clusters,
          inferredEntrances: entrances,
        },
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/data-mining/poi/resolve
   * Resolve, deduplicate, and merge multi-source noisy POI candidates into Master Golden Records
   */
  async resolvePois(req: Request, res: Response): Promise<void> {
    try {
      const { candidates } = req.body;

      if (!Array.isArray(candidates) || candidates.length === 0) {
        sendError(res, 400, 'candidates array is required');
        return;
      }

      const masterPois = await poiResolutionService.resolveAndMergePois(
        candidates as RawCandidatePoi[]
      );

      sendSuccess({
        res,
        message: `Resolved and fused ${candidates.length} candidates into ${masterPois.length} canonical Master POI records`,
        data: masterPois,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/data-mining/road-production/detect-new-roads
   * Ingest trajectory batches to extract unmapped road centerlines
   */
  async detectNewRoads(req: Request, res: Response): Promise<void> {
    try {
      const { trajectories } = req.body;

      if (!Array.isArray(trajectories) || trajectories.length === 0) {
        sendError(res, 400, 'trajectories array is required');
        return;
      }

      const newRoads = roadProductionService.detectNewRoadsFromTrajectories(
        trajectories as TrajectoryPoint[][]
      );

      sendSuccess({
        res,
        message: `Inferred ${newRoads.length} new road centerlines from trajectory clusters`,
        data: newRoads,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * POST /api/v1/data-mining/road-production/detect-closure
   * Flag sudden road closure anomaly
   */
  async detectClosure(req: Request, res: Response): Promise<void> {
    try {
      const { roadName, geometry, historicalVolumePerHour } = req.body;

      if (!roadName || !geometry) {
        sendError(res, 400, 'roadName and geometry are required');
        return;
      }

      const closure = roadProductionService.detectRoadClosure(
        roadName,
        geometry,
        historicalVolumePerHour || 50
      );

      sendSuccess({
        res,
        message: 'Road closure anomaly detected and flagged',
        data: closure,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }

  /**
   * GET /api/v1/data-mining/road-production/changes
   * List detected road changes
   */
  async getChanges(_req: Request, res: Response): Promise<void> {
    try {
      const changes = roadProductionService.getDetectedChanges();
      sendSuccess({
        res,
        data: changes,
      });
    } catch (error: any) {
      sendError(res, 500, error.message);
    }
  }
}

export const aiDataMiningController = new AiDataMiningController();
