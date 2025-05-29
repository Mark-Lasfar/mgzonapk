// /lib/db/models/visit.model.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVisit extends Document {
  visitorId: string; // Could be user ID or anonymous ID
  sellerId: string;
  referrer?: string; // The URL that referred the visitor
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const VisitSchema: Schema<IVisit> = new Schema(
  {
    visitorId: {
      type: String,
      required: true,
    },
    sellerId: {
      type: String,
      required: true,
    },
    referrer: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Visit: Model<IVisit> = mongoose.models.Visit || mongoose.model<IVisit>('Visit', VisitSchema);

export default Visit;