import mongoose, { Document, Schema } from 'mongoose';
import { GeoJsonPoint } from '../../core/types/geo.types';
import {
  DriverVehicleInfo,
  RideFareQuote,
  RideStatus,
  RideVehicleCategory,
} from './super-app.types';

export interface IRideBookingDocument extends Document {
  bookingId: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  category: RideVehicleCategory;
  status: RideStatus;
  pickupLocation: GeoJsonPoint;
  pickupAddress: string;
  dropoffLocation: GeoJsonPoint;
  dropoffAddress: string;
  otpStartTrip: string;
  assignedDriver?: DriverVehicleInfo;
  fare: RideFareQuote;
  paymentMethod: string;
  paymentStatus: string;
  requestedAt: number;
  acceptedAt?: number;
  pickupAt?: number;
  completedAt?: number;
  cancelledAt?: number;
  cancellationReason?: string;
  cancellationParty?: string;
  routePolyline?: Array<[number, number]>;
  createdAt: Date;
  updatedAt: Date;
}

const rideBookingSchema = new Schema<IRideBookingDocument>(
  {
    bookingId: { type: String, required: true, unique: true, index: true },
    riderId: { type: String, required: true, index: true },
    riderName: { type: String, required: true },
    riderPhone: { type: String, required: true },
    category: {
      type: String,
      enum: [
        'auto_rickshaw',
        'moto_bike',
        'mini_hatchback',
        'prime_sedan',
        'ev_green',
        'suv_xl',
        'outstation_intercity',
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'requested',
        'searching_driver',
        'accepted',
        'driver_arriving',
        'arrived_at_pickup',
        'in_transit',
        'completed',
        'cancelled',
      ],
      default: 'requested',
      index: true,
    },
    pickupLocation: {
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
    pickupAddress: { type: String, required: true },
    dropoffLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    dropoffAddress: { type: String, required: true },
    otpStartTrip: { type: String, required: true },
    assignedDriver: { type: Schema.Types.Mixed },
    fare: { type: Schema.Types.Mixed, required: true },
    paymentMethod: { type: String, default: 'upi' },
    paymentStatus: { type: String, default: 'pending' },
    requestedAt: { type: Number, required: true, index: true },
    acceptedAt: Number,
    pickupAt: Number,
    completedAt: Number,
    cancelledAt: Number,
    cancellationReason: String,
    cancellationParty: String,
    routePolyline: [[Number]],
  },
  {
    timestamps: true,
  }
);

rideBookingSchema.index({ pickupLocation: '2dsphere' });
rideBookingSchema.index({ dropoffLocation: '2dsphere' });
rideBookingSchema.index({ riderId: 1, createdAt: -1 });

export const RideBookingModel =
  mongoose.models.RideBooking ||
  mongoose.model<IRideBookingDocument>('RideBooking', rideBookingSchema);
