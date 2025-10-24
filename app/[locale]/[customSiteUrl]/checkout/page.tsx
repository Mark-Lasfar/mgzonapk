import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/lib/db';
import Store from '@/lib/db/models/store.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import Seller from '@/lib/db/models/seller.model';
import SellerCheckoutForm from './seller-checkout-form';

export async function generateMetadata({ params }: { params: { customSiteUrl: string; locale: string } }): Promise<Metadata> {
  try {
    await connectToDatabase();
    const store = await Store.findOne({ name: params.customSiteUrl, isActive: true }).catch((err) => {
      console.error('Error fetching store:', err);
      return null;
    });

    if (!store) {
      return { title: 'Store Not Found' };
    }

    const seller = await Seller.findById(store.sellerId).catch((err) => {
      console.error('Error fetching seller:', err);
      return null;
    });

    return {
      title: `${seller?.businessName || 'Seller'} Checkout`,
    };
  } catch (err) {
    console.error('Error generating metadata:', err);
    return { title: 'Store Not Found' };
  }
}

export default async function SellerCheckoutPage({ params }: { params: { customSiteUrl: string; locale: string } }) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/${params.locale}/sign-in?callbackUrl=/${params.locale}/${params.customSiteUrl}/checkout`);
  }

  await connectToDatabase();

  const store = await Store.findOne({ name: params.customSiteUrl, isActive: true }).catch((err) => {
    console.error('Error fetching store:', err);
    return null;
  });

  if (!store) {
    redirect(`/${params.locale}/404`);
  }

  const paymentIntegration = await SellerIntegration.findOne({
    sellerId: store.sellerId,
    type: 'payment',
    status: 'connected',
    isActive: true,
  }).catch((err) => {
    console.error('Error fetching payment integration:', err);
    return null;
  });

  if (!paymentIntegration) {
    redirect(`/${params.locale}/checkout`);
  }

  return <SellerCheckoutForm storeId={store.storeId} sellerId={store.sellerId} />;
}