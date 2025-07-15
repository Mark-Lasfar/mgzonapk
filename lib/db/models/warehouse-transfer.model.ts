import mongoose, { Schema, Document, model, Model, Types } from 'mongoose';
import SellerIntegration from './seller-integration.model';
import validator from 'validator';

export interface IWarehouseTransfer extends Document {
  sellerId: Types.ObjectId;
  productId: Types.ObjectId;
  sourceWarehouseId: string;
  targetWarehouseId: string;
  quantity: number;
  transferFee: number;
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  scheduledAt?: Date;
  completedAt?: Date;
  description?: string;
  images?: string[];
  videos?: string[];
  createdBy: string;
  sandbox: boolean;
  createdAt: Date;
  updatedAt: Date;
  webhookEvents?: Array<{
    event: string;
    timestamp: Date;
    payload: any;
  }>;
}

const warehouseTransferSchema = new Schema<IWarehouseTransfer>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'Seller',
      required: [true, 'Seller ID is required'],
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
    },
    sourceWarehouseId: {
      type: String,
      required: [true, 'Source warehouse ID is required'],
      trim: true,
    },
    targetWarehouseId: {
      type: String,
      required: [true, 'Target warehouse ID is required'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    transferFee: {
      type: Number,
      min: [0, 'Transfer fee cannot be negative'],
      default: 0,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'scheduled', 'processing', 'completed', 'failed'],
        message: '{VALUE} is not a valid status',
      },
      default: 'pending',
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    scheduledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    images: [
      {
        type: String,
        validate: {
          validator: (v: string) => validator.isURL(v, { protocols: ['http', 'https'] }),
          message: 'Image URL must be valid',
        },
      },
    ],
    videos: [
      {
        type: String,
        validate: {
          validator: (v: string) => validator.isURL(v, { protocols: ['http', 'https'] }),
          message: 'Video URL must be valid',
        },
      },
    ],
    createdBy: {
      type: String,
      required: [true, 'Created by is required'],
      trim: true,
    },
    sandbox: {
      type: Boolean,
      default: false,
    },
    webhookEvents: [
      {
        event: String,
        timestamp: Date,
        payload: Schema.Types.Mixed,
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

warehouseTransferSchema.pre('save', async function (next) {
  try {
    const sellerIntegrations = await SellerIntegration.find({
      sellerId: this.sellerId,
      status: 'connected',
      'integrationId.type': 'warehouse',
    }).populate('integrationId');
    
    const validWarehouseIds = sellerIntegrations.map((si: any) => si.integrationId.providerName);
    if (!validWarehouseIds.includes(this.sourceWarehouseId) || !validWarehouseIds.includes(this.targetWarehouseId)) {
      return next(new Error('Invalid source or target warehouse'));
    }
    next();
  } catch (error) {
    next(error as mongoose.CallbackError);
  }
});

warehouseTransferSchema.index({ sellerId: 1, productId: 1, sandbox: 1 });
warehouseTransferSchema.index({ status: 1, scheduledAt: 1 });

const WarehouseTransfer: Model<IWarehouseTransfer> =
  mongoose.models.WarehouseTransfer || model<IWarehouseTransfer>('WarehouseTransfer', warehouseTransferSchema);

export default WarehouseTransfer;