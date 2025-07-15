import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/lib/db';
import Store from '@/lib/db/models/store.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import SellerCheckoutForm from './seller-checkout-form';

export const metadata: Metadata = {
  title: 'Seller Checkout',
};

export default async function SellerCheckoutPage({ params }: { params: { customSiteUrl: string; locale: string } }) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/${params.locale}/sign-in?callbackUrl=/${params.locale}/${params.customSiteUrl}/checkout`);
  }

  await connectToDatabase();
  const store = await Store.findOne({ name: params.customSiteUrl, isActive: true });
  if (!store) {
    redirect(`/${params.locale}/404`);
  }

  // Check if the seller has customized payment settings
  const paymentIntegration = await SellerIntegration.findOne({
    sellerId: store.sellerId,
    type: 'payment',
    status: 'connected',
    isActive: true,
  });

  // If no custom payment integration, redirect to platform's checkout
  if (!paymentIntegration) {
    redirect(`/${params.locale}/checkout`);
  }

  return <SellerCheckoutForm storeId={store.storeId} sellerId={store.sellerId} />;
}