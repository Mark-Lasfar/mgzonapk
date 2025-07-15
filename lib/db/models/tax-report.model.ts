import { Schema, model, Document, Model } from 'mongoose';
import mongoose from 'mongoose';
import validator from 'validator';

export interface ITaxReport extends Document {
  sellerId: mongoose.Types.ObjectId;
  countryCode: string;
  year: number;
  month: number;
  totalPrice: number;
  totalTax: number;
  orderCount: number;
  currency: string;
  reportUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const taxReportSchema = new Schema<ITaxReport>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'Seller',
      required: [true, 'Seller ID is required'],
    },
    countryCode: {
      type: String,
      required: true,
      match: /^[A-Z]{2}$/,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 9999,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalTax: {
      type: Number,
      required: true,
      min: 0,
    },
    orderCount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => /^[A-Z]{3}$/.test(v),
        message: 'Invalid currency code',
      },
    },
    reportUrl: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || validator.isURL(v, { protocols: ['https'] }),
        message: 'Report URL must be a valid HTTPS URL',
      },
    },
  },
  { timestamps: true }
);

taxReportSchema.index({ sellerId: 1, countryCode: 1, year: 1, month: 1 });

const TaxReport: Model<ITaxReport> = mongoose.models.TaxReport || model<ITaxReport>('TaxReport', taxReportSchema);
export default TaxReport;