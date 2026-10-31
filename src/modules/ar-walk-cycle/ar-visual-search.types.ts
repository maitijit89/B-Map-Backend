import { Coordinate } from '../../core/types/geo.types';
import { ARCameraPose, ARHUDFrame, ARScreenProjection, ARWorldAnchorType, WalkRouteResult } from './ar-walk-cycle.types';

export interface VisualLocationQuery {
  /**
   * Base64 data string (e.g. data:image/jpeg;base64,...), raw base64, or image URL
   */
  image: string;

  /**
   * Optional user GPS location [longitude, latitude] for spatial proximity ranking
   */
  userLocation?: Coordinate;

  /**
   * Optional user altitude in meters
   */
  userAltitudeMeters?: number;

  /**
   * Search radius in meters (default: 50,000m)
   */
  searchRadiusMeters?: number;

  /**
   * Optional camera pose for real-time AR HUD screen projection
   */
  cameraPose?: Partial<ARCameraPose>;

  /**
   * Optional contextual user hint (e.g. "metro station", "temple", "cyber hub")
   */
  hint?: string;
}

export interface DetectedVisualFeature {
  type: 'landmark_structure' | 'signboard_ocr' | 'architectural_style' | 'transit_entrance' | 'color_signature' | 'exif_metadata';
  label: string;
  confidence: number;
  details?: string;
  boundingBox?: {
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  };
}

export interface ExifGpsMetadata {
  hasGps: boolean;
  latitude?: number;
  longitude?: number;
  altitudeMeters?: number;
  imgDirectionDegrees?: number;
  cameraMake?: string;
  cameraModel?: string;
  dateTime?: string;
}

export interface MatchedLocationCandidate {
  locationId: string;
  name: string;
  category: string;
  coordinates: Coordinate;
  address: string;
  city: string;
  state: string;
  digipin: string;
  confidenceScore: number;
  matchGrade: 'EXACT_MATCH' | 'HIGH_CONFIDENCE' | 'PROBABLE_MATCH' | 'APPROXIMATE_MATCH';
  visualEvidence: string[];
  recognizedKeywords: string[];
  distanceMeters?: number;
  bearingDegrees?: number;
  clockDirection?: string;
  cardinalDirection?: string;
  estimatedWalkingMinutes?: number;
  arHUD?: ARHUDFrame;
  walkingRoute?: WalkRouteResult;
  sourceStreetViewPanoId?: string;
  thumbnailUrl?: string;
}

export interface ARVisualSearchResponse {
  analysisId: string;
  timestamp: number;
  querySummary: {
    imageSizeBytes: number;
    hasExifGps: boolean;
    userLocationProvided: boolean;
    appliedSearchRadiusMeters: number;
  };
  imageAnalysis: {
    detectedSceneType: string;
    extractedTextList: string[];
    detectedFeatures: DetectedVisualFeature[];
    exifMetadata?: ExifGpsMetadata;
  };
  topMatch: MatchedLocationCandidate;
  alternateMatches: MatchedLocationCandidate[];
  arGuidance: {
    targetName: string;
    distanceText: string;
    compassBearingDegrees: number;
    clockDirection: string;
    relativeDirectionText: string;
    floatingBillboardsCount: number;
    arHUDFrame: ARHUDFrame;
    nextStepInstruction: string;
  };
}

