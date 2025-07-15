import mongoose, { Schema, Document } from 'mongoose';

export interface ISyncProgress extends Document {
  sellerId: mongoose.Types.ObjectId;
  provider: string;
  inventoryTotal: number;
  inventoryLastSynced: Date;
  ordersTotal: number;
  ordersPending: number;
  ordersLastSynced: Date;
  sandbox: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SyncProgressSchema = new Schema<ISyncProgress>(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true },
    inventoryTotal: { type: Number, default: 0 },
    inventoryLastSynced: { type: Date },
    ordersTotal: { type: Number, default: 0 },
    ordersPending: { type: Number, default: 0 },
    ordersLastSynced: { type: Date },
    sandbox: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.SyncProgress || mongoose.model<ISyncProgress>('SyncProgress', SyncProgressSchema);