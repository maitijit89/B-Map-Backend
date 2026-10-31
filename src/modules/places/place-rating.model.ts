import mongoose, { Document, Schema } from 'mongoose';
import { AspectRatings } from './place-rating.types';

export interface IPlaceRatingDocument extends Document {
  ratingId: string;
  placeId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  score: number;
  title?: string;
  review: string;
  aspects: AspectRatings;
  visitType: string;
  photos: string[];
  tags: string[];
  isVerifiedVisit: boolean;
  helpfulVotes: number;
  helpfulVoterIds: string[];
  reportCount: number;
  status: 'published' | 'under_review' | 'hidden';
  createdAt: Date;
  updatedAt: Date;
}

const placeRatingSchema = new Schema<IPlaceRatingDocument>(
  {
    ratingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    placeId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      default: 'Verified Navigator',
    },
    userEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    review: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
    aspects: {
      cleanliness: { type: Number, min: 1, max: 5, default: 5 },
      accessibility: { type: Number, min: 1, max: 5, default: 5 },
      hospitality: { type: Number, min: 1, max: 5, default: 5 },
      valueForMoney: { type: Number, min: 1, max: 5, default: 5 },
      amenities: { type: Number, min: 1, max: 5, default: 5 },
    },
    visitType: {
      type: String,
      enum: ['solo', 'family', 'business', 'couples', 'friends'],
      default: 'solo',
    },
    photos: [
      {
        type: String,
        trim: true,
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    isVerifiedVisit: {
      type: Boolean,
      default: false,
      index: true,
    },
    helpfulVotes: {
      type: Number,
      default: 0,
      index: true,
    },
    helpfulVoterIds: [
      {
        type: String,
      },
    ],
    reportCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['published', 'under_review', 'hidden'],
      default: 'published',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for rapid review queries & user deduplication
placeRatingSchema.index({ placeId: 1, createdAt: -1 });
placeRatingSchema.index({ placeId: 1, userId: 1 }, { unique: true });
placeRatingSchema.index({ placeId: 1, helpfulVotes: -1 });
placeRatingSchema.index({ placeId: 1, score: -1 });

export const PlaceRatingModel = mongoose.model<IPlaceRatingDocument>('PlaceRating', placeRatingSchema);

