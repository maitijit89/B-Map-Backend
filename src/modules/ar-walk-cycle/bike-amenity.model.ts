import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint } from '../../core/types/geo.types';

export interface IBikeAmenityDocument extends Document {
  amenityId: string;
  type: 'repair_stand' | 'air_pump' | 'ebike_charger' | 'secure_lockers' | 'bike_share_dock';
  name: string;
  location: GeoJsonPoint;
  availableBikesOrDocks?: {
    bikes: number;
    docks: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const bikeAmenitySchema = new Schema<IBikeAmenityDocument>(
  {
    amenityId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ['repair_stand', 'air_pump', 'ebike_charger', 'secure_lockers', 'bike_share_dock'],
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
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
    availableBikesOrDocks: {
      bikes: Number,
      docks: Number,
    },
  },
  {
    timestamps: true,
  }
);

bikeAmenitySchema.index({ location: '2dsphere' });

export const BikeAmenityModel = mongoose.model<IBikeAmenityDocument>(
  'BikeAmenity',
  bikeAmenitySchema
);
