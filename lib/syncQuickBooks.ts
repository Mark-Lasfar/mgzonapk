// lib/syncQuickBooks.ts
import { OAuthClient } from 'intuit-oauth';
import Seller from './db/models/seller.model';
import { connectToDatabase } from './db';

const oauthClient = new OAuthClient({
  clientId: process.env.QUICKBOOKS_CLIENT_ID!,
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
  environment: 'production',
  redirectUri: process.env.QUICKBOOKS_REDIRECT_URI!,
});

export async function syncQuickBooks(userId: string, order: any) {
  await connectToDatabase();
  const seller = await Seller.findOne({ userId });
  if (!seller?.quickbooks) throw new Error('QuickBooks not connected');

  oauthClient.setToken({
    access_token: seller.quickbooks.accessToken,
    refresh_token: seller.quickbooks.refreshToken,
    token_type: 'bearer',
    expires_in: Math.floor((seller.quickbooks.expiresAt.getTime() - Date.now()) / 1000),
  });

  const invoice = {
    Line: [
      {
        Amount: order.amount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: '1', name: 'Order' },
        },
      },
    ],
    CustomerRef: { value: '1' },
  };

  const url = `/v3/company/${seller.quickbooks.realmId}/invoice`;
  await oauthClient.makeApiCall({
    url,
    method: 'POST',
    body: JSON.stringify(invoice),
  });
}