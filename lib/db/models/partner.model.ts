// /lib/db/models/partner.model.ts
import { Schema, model, Document } from 'mongoose';

export interface IPartner extends Document {
  name: string;
  email: string;
  commissionRate: number;
  totalEarnings: number;
  balance: number;
  bankInfo: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    swiftCode: string;
  };
  transactions: Array<{
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    date: Date;
  }>;
  image: string; // صورة الشريك
  slug: string; // لتوليد المسار الديناميكي
  description: string; // وصف الشريك
  socialLinks: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
  };
}

const PartnerSchema = new Schema<IPartner>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    commissionRate: { type: Number, required: true, default: 10 },
    totalEarnings: { type: Number, required: true, default: 0 },
    balance: { type: Number, required: true, default: 0 },
    bankInfo: {
      accountName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      bankName: { type: String, required: true },
      swiftCode: { type: String, required: true },
    },
    transactions: [
      {
        type: { type: String, enum: ['credit', 'debit'], required: true },
        amount: { type: Number, required: true },
        description: { type: String, required: true },
        date: { type: Date, required: true, default: Date.now },
      },
    ],
    image: { type: String, required: false, default: '/images/default-partner.jpg' },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: false },
    socialLinks: {
      facebook: { type: String, required: false },
      twitter: { type: String, required: false },
      linkedin: { type: String, required: false },
    },
  },
  { timestamps: true }
);

PartnerSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  next();
});

const Partner = model<IPartner>('Partner', PartnerSchema);
export default Partner;