import mongoose, { Schema, Document } from 'mongoose';

interface ISupplier extends Document {
  sellerId: string;
  name: string;
  address: {
    street: string;
    city: string;
    state?: string;
    countryCode: string;
    postalCode: string;
  };
  contact: {
    email: string;
    phone?: string;
  };
  agreements: {
    terms: string;
    signedAt: Date;
  }[];
  type: 'local' | 'international';
  estimatedDeliveryTime: number;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema: Schema = new Schema({
  sellerId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String },
    countryCode: { type: String, required: true },
    postalCode: { type: String, required: true },
  },
  contact: {
    email: { type: String, required: true },
    phone: { type: String },
  },
  agreements: [
    {
      terms: { type: String, required: true },
      signedAt: { type: Date, required: true },
    },
  ],
  type: { type: String, enum: ['local', 'international'], required: true },
  estimatedDeliveryTime: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

SupplierSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.Supplier || mongoose.model<ISupplier>('Supplier', SupplierSchema);
