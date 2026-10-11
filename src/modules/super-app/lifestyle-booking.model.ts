import mongoose, { Document, Schema } from 'mongoose';
import {
  LifestyleBookingStatus,
  LifestyleBookingType,
  LifestylePoiCategory,
  LifestyleServiceItem,
} from './super-app.types';

export interface ILifestyleBookingDocument extends Document {
  bookingId: string;
  userId: string;
  userName: string;
  userPhone: string;
  poiId: string;
  poiName: string;
  category: LifestylePoiCategory;
  bookingType: LifestyleBookingType;
  status: LifestyleBookingStatus;
  bookingDate: string;
  timeSlot: string;
  partySize?: number;
  selectedItems?: LifestyleServiceItem[];
  seatNumbers?: string[];
  specialRequests?: string;
  confirmationCode: string;
  totalAmountInr: number;
  depositPaidInr: number;
  createdAtDate: Date;
  updatedAtDate: Date;
}

const lifestyleBookingSchema = new Schema<ILifestyleBookingDocument>(
  {
    bookingId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userPhone: { type: String, required: true },
    poiId: { type: String, required: true, index: true },
    poiName: { type: String, required: true },
    category: {
      type: String,
      enum: [
        'dining_restaurant',
        'cafe_bistro',
        'nightlife_pub',
        'cinema_multiplex',
        'spa_wellness',
        'shopping_mall',
        'healthcare_247',
      ],
      required: true,
      index: true,
    },
    bookingType: {
      type: String,
      enum: [
        'table_reservation',
        'service_appointment',
        'event_movie_ticket',
        'shopping_deal',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    bookingDate: { type: String, required: true, index: true },
    timeSlot: { type: String, required: true },
    partySize: Number,
    selectedItems: [Schema.Types.Mixed],
    seatNumbers: [String],
    specialRequests: String,
    confirmationCode: { type: String, required: true, index: true },
    totalAmountInr: { type: Number, default: 0 },
    depositPaidInr: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

lifestyleBookingSchema.index({ poiId: 1, bookingDate: 1, timeSlot: 1 });
lifestyleBookingSchema.index({ userId: 1, createdAt: -1 });

export const LifestyleBookingModel =
  mongoose.models.LifestyleBooking ||
  mongoose.model<ILifestyleBookingDocument>('LifestyleBooking', lifestyleBookingSchema);
