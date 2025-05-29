import { Document, Model, model, models, Schema, Types } from 'mongoose';

export interface IPointsTransaction extends Document {
  userId: Types.ObjectId;
  amount: number;
  type: 'earn' | 'redeem';
  description: string;
  orderId?: Types.ObjectId;
  createdAt: Date;
}

const pointsTransactionSchema = new Schema<IPointsTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    type: { type: String, required: true, enum: ['earn', 'redeem'] },
    description: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
  },
  {
    timestamps: true,
  }
);

pointsTransactionSchema.index({ userId: 1, createdAt: -1 });

const PointsTransaction =
  models.PointsTransaction || model<IPointsTransaction>('PointsTransaction', pointsTransactionSchema);
export default PointsTransaction as Model<IPointsTransaction>;