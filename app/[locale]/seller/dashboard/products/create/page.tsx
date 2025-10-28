// app/[locale]/(root)/seller/dashboard/products/create/page.tsx
import Link from 'next/link';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import CreateProductForm from './create-product-form';

export const metadata: Metadata = {
  title: 'Create Product - Seller Dashboard',
  description: 'Create a new product in your seller dashboard',
};

export default async function CreateProductPage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seller.products' });
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'SELLER') {
    redirect(`/${locale}/sign-in`);
  }

  return (
    <main className="max-w-6xl mx-auto p-4">
      <nav className="flex items-center gap-2 mb-5">
        <Link
          href={`/${locale}/seller/dashboard/products`}
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