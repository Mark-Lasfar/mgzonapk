import { Schema, model, Document, models } from 'mongoose';

export interface IWithdrawalRequest extends Document {
  sellerId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  paymentMethod?: 'bank_transfer' | 'stripe' | 'paypal';
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'Seller',
      required: [true, 'Seller ID is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: '{VALUE} is not a valid status',
      },
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['bank_transfer', 'stripe', 'paypal'],
        message: '{VALUE} is not a valid payment method',
      },
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

const WithdrawalRequest =
  models.WithdrawalRequest || model<IWithdrawalRequest>('WithdrawalRequest', WithdrawalRequestSchema);

export default WithdrawalRequest;