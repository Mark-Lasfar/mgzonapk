// lib/wise.ts
import axios from 'axios';
import { connectToDatabase } from './db';
import Partner from './db/models/partner.model';

const wiseClient = axios.create({
  baseURL: process.env.WISE_ENVIRONMENT === 'live' ? 'https://api.wise.com' : 'https://api.sandbox.wise.com',
  headers: {
    Authorization: `Bearer ${process.env.WISE_API_TOKEN}`,
  },
});

export async function createTransfer({
  partnerId,
  amount,
  currency,
}: {
  partnerId: string;
  amount: number;
  currency: string;
}) {
  await connectToDatabase();
  const partner = await Partner.findById(partnerId);
  if (!partner) throw new Error('Partner not found');

  interface QuoteResponse {
    id: string;
  }
  
  const quote = await wiseClient.post<QuoteResponse>('/v1/quotes', {
    sourceCurrency: currency,
    targetCurrency: currency,
    sourceAmount: amount,
    profile: process.env.WISE_PROFILE_ID,
  });
  
  const transfer = await wiseClient.post('/v1/transfers', {
    targetAccount: {
      type: 'iban',
      details: {
        iban: partner.bankInfo.accountNumber,
        accountHolderName: partner.bankInfo.accountName,
      },
    },
    quote: quote.data.id,
    customerTransactionId: `TX-${Date.now()}`,
    details: {
      reference: `Payment to ${partner.name}`,
    },
  });

  await Partner.findByIdAndUpdate(partnerId, {
    $push: {
      transactions: {
        type: 'debit',
        amount,
        description: `Transfer to ${partner.name}`,
        date: new Date(),
      },
    },
    $inc: { balance: -amount },
  });

  return transfer.data;
}