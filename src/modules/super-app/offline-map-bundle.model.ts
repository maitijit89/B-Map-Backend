import mongoose, { Document, Schema } from 'mongoose';
import { OfflineLayerType } from './super-app.types';

export interface IOfflineMapBundleDocument extends Document {
  bundleId: string;
  regionName: string;
  state: string;
  bounds: [number, number, number, number];
  version: string;
  totalSizeBytes: number;
  compressedSizeBytes: number;
  sha256Checksum: string;
  layersIncluded: OfflineLayerType[];
  roadNetworkNodesCount: number;
  poiEntriesCount: number;
  downloadUrl: string;
  lastUpdatedAt: string;
  isMandatorySecurityUpdate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const offlineMapBundleSchema = new Schema<IOfflineMapBundleDocument>(
  {
    bundleId: { type: String, required: true, unique: true, index: true },
    regionName: { type: String, required: true },
    state: { type: String, required: true },
    bounds: { type: [Number], required: true },
    version: { type: String, required: true },
    totalSizeBytes: { type: Number, required: true },
    compressedSizeBytes: { type: Number, required: true },
    sha256Checksum: { type: String, required: true },
    layersIncluded: [{ type: String }],
    roadNetworkNodesCount: { type: Number, required: true },
    poiEntriesCount: { type: Number, required: true },
    downloadUrl: { type: String, required: true },
    lastUpdatedAt: { type: String, required: true },
    isMandatorySecurityUpdate: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export const OfflineMapBundleModel =
  mongoose.models.OfflineMapBundle ||
  mongoose.model<IOfflineMapBundleDocument>('OfflineMapBundle', offlineMapBundleSchema);
