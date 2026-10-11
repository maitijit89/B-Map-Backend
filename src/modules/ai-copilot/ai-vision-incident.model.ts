import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint } from '../../core/types/geo.types';
import { RoadHazardVisualType } from './ai-llm.types';

export interface IAIVisionIncidentDocument extends Document {
  incidentId: string;
  hazardType: RoadHazardVisualType;
  confidence: number;
  location: GeoJsonPoint;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  sourceImageUrl?: string;
  verifiedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const aiVisionIncidentSchema = new Schema<IAIVisionIncidentDocument>(
  {
    incidentId: { type: String, required: true, unique: true, index: true },
    hazardType: {
      type: String,
      enum: [
        'pothole_crater',
        'flooding_waterlogging',
        'construction_barricade',
        'fallen_tree_debris',
        'disabled_vehicle_shoulder',
        'damaged_guardrail',
      ],
      required: true,
      index: true,
    },
    confidence: { type: Number, required: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number], // [lon, lat]
        required: true,
      },
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    description: { type: String, required: true },
    sourceImageUrl: String,
    verifiedCount: { type: Number, default: 1 },
  },
  {
    timestamps: true,
  }
);

aiVisionIncidentSchema.index({ location: '2dsphere' });

export const AIVisionIncidentModel = mongoose.model<IAIVisionIncidentDocument>(
  'AIVisionIncident',
  aiVisionIncidentSchema
);
