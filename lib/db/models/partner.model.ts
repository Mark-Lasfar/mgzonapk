import { Schema, model, Document } from 'mongoose';

export interface IPartner extends Document {
  name: string;
  email: string;
  commissionRate: number; // Seller's commission rate (in percentage)
  totalEarnings: number; // Total earnings from sales
  balance: number; // Remaining balance for withdrawal
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
}

const PartnerSchema = new Schema<IPartner>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    commissionRate: { type: Number, required: true, default: 10 }, // Default 10% commission rate
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
  },
  { timestamps: true }
);

const Partner = model<IPartner>('Partner', PartnerSchema);
export default Partner;