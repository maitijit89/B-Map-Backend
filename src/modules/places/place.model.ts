import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint } from '../../core/types/geo.types';

export interface IPlace extends Document {
  name: string;
  category: string;
  description?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  location: GeoJsonPoint;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const placeSchema = new Schema<IPlace>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        validate: {
          validator: (coords: number[]) => {
            return (
              coords.length === 2 &&
              coords[0] >= -180 &&
              coords[0] <= 180 &&
              coords[1] >= -90 &&
              coords[1] <= 90
            );
          },
          message: 'Coordinates must be valid [longitude, latitude] pair (-180..180, -90..90)',
        },
      },
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere index for high performance geospatial queries ($near, $geoWithin, $geoIntersects)
placeSchema.index({ location: '2dsphere' });
placeSchema.index({ category: 1, location: '2dsphere' });
placeSchema.index({ name: 'text', description: 'text', tags: 'text' });

export const Place = mongoose.model<IPlace>('Place', placeSchema);
