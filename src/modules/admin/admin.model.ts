import mongoose, { Document, Schema } from 'mongoose';

export interface IAdminAuditLog extends Document {
  admin_email: string;
  action: string;
  target_type: string;
  target_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    admin_email: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    target_type: {
      type: String,
      required: true,
      index: true,
    },
    target_id: {
      type: String,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ip_address: {
      type: String,
      default: '127.0.0.1',
    },
  },
  {
    timestamps: true,
  }
);

adminAuditLogSchema.index({ createdAt: -1 });

export const AdminAuditLog = mongoose.model<IAdminAuditLog>(
  'AdminAuditLog',
  adminAuditLogSchema
);

export interface ISystemConfigDoc extends Document {
  key: string;
  value: any;
  updated_by: string;
  updatedAt: Date;
}

const systemConfigSchema = new Schema<ISystemConfigDoc>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    updated_by: {
      type: String,
      default: 'system',
    },
  },
  {
    timestamps: true,
  }
);

export const SystemConfigModel = mongoose.model<ISystemConfigDoc>(
  'SystemConfig',
  systemConfigSchema
);
