import mongoose, { Document, Model, Schema } from 'mongoose';
import { AppLifecycleState, DynamicHardwareSensorMetrics, TelemetryClientPlatform, TelemetryEventType } from './telemetry.types';

export interface ITelemetryDocument extends Document {
  // Frequently Indexed Identifiers (Distinct Columns)
  eventId: string;
  batchId?: string;
  deviceId: string;
  userId?: string;
  sessionId: string;
  eventType: TelemetryEventType;
  platform: TelemetryClientPlatform;
  appVersion: string;
  clientTimezone: string;
  ipAddress?: string;
  geoCountry?: string;
  geoCity?: string;
  appState?: AppLifecycleState;

  // Session & Analytics
  sessionStartTime?: Date;
  sessionEndTime?: Date;
  sessionDurationSeconds?: number;

  // Fraud Detection Results
  isFraudDetected: boolean;
  fraudScore: number;
  fraudReasons: string[];

  // Dynamic Hardware / Sensor Metrics Field (JSONB / Flexible BSON storage)
  // Accommodates ~120 dynamic hardware, IMU, battery, screen, environment, and radio attributes
  metrics: DynamicHardwareSensorMetrics;

  // Timestamps
  timestamp: Date;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const telemetrySchema = new Schema<ITelemetryDocument>(
  {
    // 1. Frequently Indexed Identifiers in Distinct Columns
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    batchId: {
      type: String,
      index: true,
      sparse: true,
      trim: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    userId: {
      type: String,
      index: true,
      sparse: true,
      trim: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    eventType: {
      type: String,
      enum: [
        'heartbeat',
        'session_start',
        'session_end',
        'sensor_batch',
        'telematics',
        'navigation_ping',
        'app_state_change',
      ],
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web', 'automotive', 'iot'],
      required: true,
      index: true,
    },
    appVersion: {
      type: String,
      required: true,
      trim: true,
    },
    clientTimezone: {
      type: String,
      required: true,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    geoCountry: {
      type: String,
      trim: true,
    },
    geoCity: {
      type: String,
      trim: true,
    },
    appState: {
      type: String,
      enum: ['active', 'background', 'inactive', 'terminated'],
    },

    // 2. Computed Session Length & Analytics
    sessionStartTime: {
      type: Date,
    },
    sessionEndTime: {
      type: Date,
    },
    sessionDurationSeconds: {
      type: Number,
      index: true,
    },

    // 3. Fraud Detection Flags & Scores
    isFraudDetected: {
      type: Boolean,
      default: false,
      index: true,
    },
    fraudScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    fraudReasons: {
      type: [String],
      default: [],
    },

    // 4. Dynamic Hardware / Sensor Metrics Field (JSONB / BSON flexible object)
    // Dumps ~120 dynamic hardware/sensor metrics into an indexed, schema-flexible field
    metrics: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // 5. Timestamps
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: false, // Ensures empty dynamic metric objects are preserved in JSONB
  }
);

// High-Throughput Compound & Filtering Indexes
telemetrySchema.index({ deviceId: 1, timestamp: -1 });
telemetrySchema.index({ sessionId: 1, timestamp: -1 });
telemetrySchema.index({ eventType: 1, timestamp: -1 });
telemetrySchema.index({ isFraudDetected: 1, timestamp: -1 });
telemetrySchema.index({ platform: 1, appVersion: 1 });

// Target indexes on commonly queried dynamic hardware metrics
telemetrySchema.index({ 'metrics.batteryLevel': 1 });
telemetrySchema.index({ 'metrics.isEmulator': 1 });
telemetrySchema.index({ 'metrics.speed': 1 });

export const TelemetryModel: Model<ITelemetryDocument> =
  mongoose.models.Telemetry || mongoose.model<ITelemetryDocument>('Telemetry', telemetrySchema);
