import mongoose, { Document, Schema } from 'mongoose';

export interface ISpatialLayerDocument extends Document {
  layerId: string;
  name: string;
  layerType: 'vector_tile_cache' | 'heatmap_snapshot' | 'multi_floor' | 'weather_radar';
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  payload: Record<string, any>;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const spatialLayerSchema = new Schema<ISpatialLayerDocument>(
  {
    layerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    layerType: {
      type: String,
      enum: ['vector_tile_cache', 'heatmap_snapshot', 'multi_floor', 'weather_radar'],
      required: true,
      index: true,
    },
    bounds: {
      west: Number,
      south: Number,
      east: Number,
      north: Number,
    },
    payload: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, index: { expires: '1d' } },
  },
  {
    timestamps: true,
  }
);

export const SpatialLayerModel = mongoose.model<ISpatialLayerDocument>(
  'SpatialLayer',
  spatialLayerSchema
);
