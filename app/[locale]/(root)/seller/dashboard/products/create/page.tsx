import Link from 'next/link';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import CreateProductForm from './create-product-form';

export const metadata: Metadata = {
  title: 'Create Product - Seller Dashboard',
  description: 'Create a new product in your seller dashboard',
};

async function getSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session;
}

export default async function CreateProductPage({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'seller.products' });

  try {
    await getSession();
  } catch (error) {
    return <div className="text-red-500 mx-auto max-w-md p-4">{t('errors.unauthorized')}</div>;
  }

  return (
    <main className="max-w-6xl mx-auto p-4">
      <nav className="flex items-center gap-2 mb-5">
        <Link
          href={`/${params.locale}/seller/dashboard/products`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('products')}
        </Link>
        <span className="text-muted-foreground">›</span>
        <span className="font-medium">{t('createProduct')}</span>
      </nav>
      <CreateProductForm />
    </main>
  );
}