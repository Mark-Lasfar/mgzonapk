import mongoose, { Schema, Document } from 'mongoose';

export interface AdCampaign extends Document {
  sellerId: string;
  integrationId: mongoose.Types.ObjectId;
  providerName: string;
  campaignId: string; // External ID from ad platform
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  budget: { amount: number; currency: string };
  schedule: { startDate: Date; endDate?: Date };
  targeting: Record<string, any>;
  creatives: Array<{
    type: 'image' | 'video' | 'text';
    url: string;
    metadata: Record<string, any>;
  }>;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    lastSynced: Date;
  };
  products: mongoose.Types.ObjectId[]; // معرفات المنتجات المرتبطة
  createdAt: Date;
  updatedAt: Date;
  sandbox: boolean;
}

const AdCampaignSchema: Schema<AdCampaign> = new Schema(
  {
    sellerId: { type: String, required: true, index: true },
    integrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Integration', required: true },
    providerName: { type: String, required: true },
    campaignId: { type: String, required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['draft', 'active', 'paused', 'completed', 'failed'], default: 'draft' },
    budget: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
    },
    schedule: {
      startDate: { type: Date, required: true },
      endDate: { type: Date },
    },
    targeting: { type: Schema.Types.Mixed, default: {} },
    creatives: [
      {
        type: { type: String, enum: ['image', 'video', 'text'], required: true },
        url: { type: String, required: true },
        metadata: { type: Schema.Types.Mixed, default: {} },
      },
    ],
    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      spend: { type: Number, default: 0 },
      lastSynced: { type: Date },
    },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: [] }], // إضافة حقل المنتجات
    sandbox: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AdCampaignSchema.index({ sellerId: 1, campaignId: 1, sandbox: 1 }, { unique: true });

export default mongoose.models.AdCampaign || mongoose.model<AdCampaign>('AdCampaign', AdCampaignSchema);